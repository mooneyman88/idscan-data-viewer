from flask import Flask, render_template, request, jsonify
from flask_httpauth import HTTPBasicAuth
import sqlite3
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine, text
import os                               

postgre_address = os.environ.get('POSTGRE_ADDRESS')
app = Flask(__name__)
auth = HTTPBasicAuth()

users = {
    os.environ.get('ADMIN'): os.environ.get('PASSWORD')
}

@auth.get_password
def get_pw(username):
    if username in users:
        return users.get(username)
    return None


def get_db_connection():
    db_url = f"postgresql+psycopg2://{os.environ.get('POSTGRE_ADDRESS')}"
    engine = create_engine(db_url)
    return engine



@app.route('/data', methods=['POST'])
@auth.login_required
def data():
    start_date_1 = request.form['start_date_1']
    end_date_1 = request.form['end_date_1']
    enable_second_range = request.form.get('enable_second_range') == 'true'
    start_date_2 = request.form.get('start_date_2')
    end_date_2 = request.form.get('end_date_2')

    engine = get_db_connection()

    query_1 = text('SELECT * FROM door_data WHERE scan_time BETWEEN :start_date_1 AND :end_date_1')
    df_1 = pd.read_sql(query_1, engine, params={"start_date_1": start_date_1, "end_date_1": end_date_1})

    if enable_second_range:
        query_2 = text('SELECT * FROM door_data WHERE scan_time BETWEEN :start_date_2 AND :end_date_2')
        df_2 = pd.read_sql(query_2, engine, params={"start_date_2": start_date_2, "end_date_2": end_date_2})
    else:
        df_2 = pd.DataFrame()  # Empty DataFrame if second range is not enabled


    ##### DATA PREPARATION #####

    gender_data_1 = df_1[df_1['gender'] != 'Unknown']['gender'].value_counts().to_dict()
    avg_age_1 = df_1[df_1['gender'] != 'Unknown'].groupby('gender')['age'].mean().round().to_dict()
    nationality_data_1 = df_1[df_1['nationality'] != 'United Kingdom']['nationality'].value_counts().nlargest(
        20).to_dict()
    weeknight_data_1 = df_1['weeknight'].value_counts().to_dict()
    avg_age_nationality_1 = df_1[df_1['nationality'] != 'United Kingdom'].groupby('nationality')[
        'age'].mean().round().to_dict()
    predominant_gender_nationality_1 = df_1.loc[
        (df_1['nationality'] != 'United Kingdom') & (df_1['gender'] != 'Unknown')
        ].groupby('nationality')['gender'].agg(lambda x: x.value_counts().idxmax()).to_dict()

    if enable_second_range:
        gender_data_2 = df_2[df_2['gender'] != 'Unknown']['gender'].value_counts().to_dict()
        avg_age_2 = df_2[df_2['gender'] != 'Unknown'].groupby('gender')['age'].mean().round().to_dict()
        nationality_data_2 = df_2[df_2['nationality'] != 'United Kingdom']['nationality'].value_counts().nlargest(
            20).to_dict()
        weeknight_data_2 = df_2['weeknight'].value_counts().to_dict()
        avg_age_nationality_2 = df_2[df_2['nationality'] != 'United Kingdom'].groupby('nationality')[
            'age'].mean().round().to_dict()
        predominant_gender_nationality_2 = df_2.loc[
            (df_2['nationality'] != 'United Kingdom') & (df_2['gender'] != 'Unknown')].groupby('nationality')['gender'].agg(lambda x: x.value_counts().idxmax()).to_dict()
    else:
        gender_data_2 = None
        avg_age_2 = None
        nationality_data_2 = None
        weeknight_data_2 = None
        avg_age_nationality_2 = None
        predominant_gender_nationality_2 = None

    top_customers_1 = df_1['full_name'].str.title().value_counts().nlargest(20).to_dict()
    top_customers_2 = df_2['full_name'].str.title().value_counts().nlargest(
        20).to_dict() if enable_second_range else None

    return jsonify({
        'gender_data_1': gender_data_1,
        'nationality_data_1': nationality_data_1,
        'avg_age_1': avg_age_1,
        'avg_age_nationality_1': avg_age_nationality_1,
        'predominant_gender_nationality_1': predominant_gender_nationality_1,
        'weeknight_data_1': weeknight_data_1,
        'gender_data_2': gender_data_2,
        'nationality_data_2': nationality_data_2,
        'avg_age_2': avg_age_2,
        'avg_age_nationality_2': avg_age_nationality_2,
        'predominant_gender_nationality_2': predominant_gender_nationality_2,
        'weeknight_data_2': weeknight_data_2,
        'top_customers_1': top_customers_1,
        'top_customers_2': top_customers_2
    })


@app.route('/monthly_visits', methods=['GET'])
@auth.login_required
def monthly_visits():
    conn = get_db_connection()
    query = 'SELECT scan_time FROM door_data'
    df = pd.read_sql_query(query, conn)

    df['scan_time'] = pd.to_datetime(df['scan_time'])
    df['Year'] = df['scan_time'].dt.year
    df['Month'] = df['scan_time'].dt.strftime('%B')

    monthly_visits = df.groupby(['Year', 'Month']).size().unstack(fill_value=0).T
    monthly_visits = monthly_visits.reindex(
        ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
         'December'])
    # print(monthly_visits)

    return jsonify(monthly_visits.to_dict())


@app.route('/top-visitors')
@auth.login_required
def top_visitors():
    conn = get_db_connection()
    query = 'SELECT full_name FROM door_data'
    df = pd.read_sql_query(query, conn)
    conn.close()

    top_customers_1 = df['full_name'].value_counts().nlargest(20).to_dict()

    return render_template('top-visitors.html', top_customers_1=top_customers_1)


@app.route('/line')
@auth.login_required
def line_chart():
    return render_template('line_chart.html')


@app.route('/')
@auth.login_required
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run()