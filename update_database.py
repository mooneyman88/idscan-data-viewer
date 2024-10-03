import os
import pickle
import base64
import pyzipper
import pandas as pd
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from email.mime.text import MIMEText
from googleapiclient.errors import HttpError
from sqlalchemy import create_engine, Column, Integer, String, DateTime, PrimaryKeyConstraint, cast
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import IntegrityError
from sqlalchemy.types import DateTime


Base = declarative_base()

class DoorData(Base):
    __tablename__ = 'door_data'

    scan_time = Column(DateTime, primary_key=True)
    full_name = Column(String, primary_key=True)
    date_of_birth = Column(DateTime)
    visit_count = Column(Integer)
    nationality = Column(String)
    gender = Column(String)
    age = Column(Integer)
    weeknight = Column(String)

    __table_args__ = (
        PrimaryKeyConstraint('scan_time', full_name),
    )

def determine_night_of_week(scan_time):
    day_of_week = scan_time.weekday()  # Monday is 0 and Sunday is 6
    hour = scan_time.hour

    if hour >= 22:  # 10 PM onwards
        return day_of_week
    elif hour < 6:  # Midnight to 6 AM
        return (day_of_week - 1) % 7
    else:
        return day_of_week

def apply_weeknight_str(key):
    if key == 0:
        return 'Monday'
    elif key == 1:
        return 'Tuesday'
    elif key == 2:
        return 'Wednesday'
    elif key == 3:
        return 'Thursday'
    elif key == 4:
        return 'Friday'
    elif key == 5:
        return 'Saturday'
    elif key == 6:
        return 'Sunday'

def authenticate_gmail():
    SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
    creds = None
    # if os.path.exists('token.pickle'):
    #     os.remove('token.pickle')  # Remove the old token to force re-authentication
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    service = build('gmail', 'v1', credentials=creds)
    return service

def fetch_unread_emails(service):
    results = service.users().messages().list(userId='me', labelIds=['INBOX'], q='is:unread').execute()
    messages = results.get('messages', [])
    return messages

def process_email(service, msg_id, zip_password):
    msg = service.users().messages().get(userId='me', id=msg_id).execute()

    for part in msg['payload'].get('parts', []):
        if part['filename']:
            if 'data' in part['body']:
                data = part['body']['data']
            else:
                att_id = part['body']['attachmentId']
                att = service.users().messages().attachments().get(userId='me', messageId=msg_id, id=att_id).execute()
                data = att['data']

            file_data = base64.urlsafe_b64decode(data.encode('UTF-8'))
            path = os.path.join('reports', part['filename'])

            os.makedirs('reports', exist_ok=True)
            with open(path, 'wb') as f:
                f.write(file_data)
                print(f"Attachment {path} downloaded.")

                try:
                    with pyzipper.AESZipFile(path) as zf:
                        zf.extractall(path='reports', pwd=zip_password.encode())
                        print(f"Extracted contents of {path}")
                except pyzipper.BadZipFile:
                    print(f"BadZipFile error for {path}, skipping extraction.")

                # Delete the zip file
                os.remove(path)
                print(f"Deleted {path}")

            csv_path = os.path.join('reports', part['filename'].replace('.zip', '.csv'))
            if not os.path.exists(csv_path):
                print(f"CSV file {csv_path} not found, skipping.")
                continue

            try:
                df = pd.read_csv(csv_path, on_bad_lines='skip')
            except FileNotFoundError:
                print(f"FileNotFoundError for {csv_path}, skipping.")
                continue

            columns_to_keep = ['Scan Time', 'Full Name', 'Date of Birth', 'Visit Count', 'Document Type', 'Gender']
            df = df[columns_to_keep]
            df = df.dropna()

            df['Scan Time'] = pd.to_datetime(df['Scan Time'], format='%d/%m/%Y %H:%M:%S')
            df = df[(df['Scan Time'].dt.hour >= 21) | (df['Scan Time'].dt.hour < 5)] # Filter out data that is not between 9 PM and 5 AM
            df['Date of Birth'] = pd.to_datetime(df['Date of Birth'], format='%d/%m/%Y')
            df['Age'] = df.apply(lambda row: row['Scan Time'].year - row['Date of Birth'].year - ((row['Scan Time'].month, row['Scan Time'].day) < (row['Date of Birth'].month, row['Date of Birth'].day)), axis=1)
            df['Document Type'] = df['Document Type'].apply(lambda x: x.split(' - ')[0])
            df.rename(columns={'Document Type': 'Nationality'}, inplace=True)
            df['Weeknight'] = df['Scan Time'].apply(determine_night_of_week)
            df['Weeknight'] = df['Weeknight'].apply(apply_weeknight_str)

            return df

def mark_email_as_read(service, msg_id):
    service.users().messages().modify(userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}).execute()

def add_new_data_to_database(df):
    db_url = f"postgresql+psycopg2://{os.environ.get('POSTGRE_ADDRESS')}"
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    data_to_insert = df.to_dict(orient='records')
    for row in data_to_insert:
        entry = DoorData(
            scan_time=row['Scan Time'],
            full_name=row['Full Name'],
            date_of_birth=row['Date of Birth'],
            visit_count=row['Visit Count'],
            nationality=row['Nationality'],
            gender=row['Gender'],
            age=row['Age'],
            weeknight=row['Weeknight']
        )
        existing_entry = session.query(DoorData).filter(
            cast(DoorData.scan_time, DateTime) == row['Scan Time'],
            DoorData.full_name == row['Full Name']
        ).first()
        if existing_entry is None:
            try:
                session.add(entry)
                session.commit()
            except IntegrityError:
                session.rollback()
                print(f"Integrity error for {row['Scan Time']} and {row['Full Name']} - skipping.")
        else:
            print(f"Duplicate entry found for {row['Scan Time']} and {row['Full Name']} - skipping.")

    session.close()

def send_confirmation_email(service, to, subject, body):
    message = MIMEText(body)
    message['to'] = to
    message['subject'] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    message = {'raw': raw}

    try:
        message = service.users().messages().send(userId='me', body=message).execute()
        print(f"Message Id: {message['id']}")
    except HttpError as error:
        print(f"An error occurred: {error}")

if __name__ == '__main__':
    zip_password = os.environ.get('ZIP_PASSWORD')
    service = authenticate_gmail()
    unread_emails = fetch_unread_emails(service)

    for email in unread_emails:
        msg_id = email['id']
        df = process_email(service, msg_id, zip_password)
        if df is not None:
            add_new_data_to_database(df)
        mark_email_as_read(service, msg_id)
    send_confirmation_email(service, os.environ.get('ADMIN_EMAIL'), 'Data Processing Complete', 'All new data has been processed and added to the database.')