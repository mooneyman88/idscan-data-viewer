Chart.defaults.font.family = 'Georgia';
Chart.defaults.font.size = 14;
Chart.defaults.color = "#313131";



// // // // // DATE PICKERS // // // // //
const picker1 = new Litepicker({
    element: document.getElementById('start_date_1'),
    elementEnd: document.getElementById('end_date_1'),
    singleMode: false,
    autoApply: true,
    format: 'DD/MM/YYYY'
});

const picker2 = new Litepicker({
    element: document.getElementById('start_date_2'),
    elementEnd: document.getElementById('end_date_2'),
    singleMode: false,
    autoApply: true,
    format: 'DD/MM/YYYY'
});

// // // // //  DEFAULT DATE RANGE SET TO PAST MONTH FROM PRESENT DATE  // // // // //
window.onload = function() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    picker1.setDateRange(startDate, endDate);
    picker2.setDateRange(startDate, endDate);
};

document.getElementById('enable_second_range').addEventListener('change', function() {
    const secondDateRange = document.getElementById('second_date_range');
    if (this.checked) {
        secondDateRange.style.display = 'block';
    } else {
        secondDateRange.style.display = 'none';
    }
});

document.getElementById('submit').addEventListener('click', function() {
    const startDate1 = picker1.getStartDate().format('YYYY-MM-DD');
    const endDate1 = picker1.getEndDate().format('YYYY-MM-DD');
    const enableSecondRange = document.getElementById('enable_second_range').checked;
    let startDate2 = null;
    let endDate2 = null;

    if (enableSecondRange) {
        startDate2 = picker2.getStartDate().format('YYYY-MM-DD');
        endDate2 = picker2.getEndDate().format('YYYY-MM-DD');
    }

    fetch('/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'start_date_1': startDate1,
            'end_date_1': endDate1,
            'start_date_2': startDate2,
            'end_date_2': endDate2,
            'enable_second_range': enableSecondRange
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Received data:', data); // Debugging log

        // Update gender chart
        updateChart(genderChart, Object.keys(data.gender_data_1), Object.values(data.gender_data_1), data.gender_data_2 ? Object.values(data.gender_data_2) : null, data.avg_age_1, data.avg_age_2);
        
        // Update nationality chart
        updateChart(nationalityChart, Object.keys(data.nationality_data_1), Object.values(data.nationality_data_1), data.nationality_data_2 ? Object.values(data.nationality_data_2) : null, data.avg_age_nationality_1, data.avg_age_nationality_2, data.predominant_gender_nationality_1, data.predominant_gender_nationality_2);

        // Update weeknight chart
        updateChart(weeknightChart, Object.keys(data.weeknight_data_1), Object.values(data.weeknight_data_1), data.weeknight_data_2 ? Object.values(data.weeknight_data_2) : null);

        // Update text information
        updateTextInfo(data);
    });
});


// // // // // CHARTS // // // // //

// // // // // GENDER CHART // // // // //
const genderChart = new Chart(document.getElementById('genderChart'), {
    type: 'doughnut',
    data: {
        labels: [],
        datasets: [{
            label: 'Total',
            data: [],
            backgroundColor: ['#ffc0cb', '#6495ed'],
            avgAge: [] // Add avgAge array
        }, {
            label: 'Total',
            data: [],
            backgroundColor: ['#dc8383', '#2882bf'],
            hidden: true,
            avgAge: [] // Add avgAge array
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Gender Distribution'
            },
            tooltip: {
                callbacks: {
                    label: function(tooltipItem) {
                        const dataset = tooltipItem.dataset;
                        const index = tooltipItem.dataIndex;
                    
                        // Check if avgAge array exists and has a value for the current index
                        const avgAge = dataset.avgAge && dataset.avgAge.length > index ? dataset.avgAge[index] : null;
                    
                        let label = dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += tooltipItem.raw; // Tooltip item value
                    
                        if (avgAge !== null) {
                            label += ` (Avg Age: ${avgAge})`; // Append avgAge if available
                        }
                    
                        return label;
                    }
                    
                }
            }
        }
    }
});

// // // // // NATIONALITY CHART // // // // //
const nationalityChart = new Chart(document.getElementById('nationalityChart'), {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Total',
            backgroundColor: '#fcc200',
            data: [],
            predominantGender: [],
            avgAge: []
        }, {
            label: 'Total',
            backgroundColor: '#ff6b6b',
            data: [],
            hidden: true,
            predominantGender: [], 
            avgAge: [] 
        }]
    },
    options: {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Top Nationalities'
            },
            tooltip: {
                callbacks: {
                    label: function(tooltipItem) {
                        const dataset = tooltipItem.dataset;
                        const index = tooltipItem.dataIndex;

                        let label = dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += tooltipItem.raw; // Tooltip item value

                        // Check if predominantGender array exists and has a value for the current index
                        const predominantGender = dataset.predominantGender && dataset.predominantGender.length > index ? dataset.predominantGender[index] : null;
                        if (predominantGender !== null) {
                            label += ` (Mostly ${predominantGender})`; // Append predominantGender if available
                        }

                        // Check if avgAge array exists and has a value for the current index
                        const avgAge = dataset.avgAge && dataset.avgAge.length > index ? dataset.avgAge[index] : null;
                        if (avgAge !== null) {
                            label += ` (Avg Age: ${avgAge})`; // Append avgAge if available
                        }

                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                stacked: false,
                grid: {
                    display: true,
                    color: "rgba(226,150,131,0.2)"
                }
            },
            x: {
                stacked: false,
                grid: {
                    display: false
                }
            }
        }
    }
});

// // // // // WEEKNIGHT CHART // // // // //
const weeknightChart = new Chart(document.getElementById('weeknightChart'), {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Total',
            data: [],
            backgroundColor: '#fcc200',
        }, 
        {
            hidden: true,
            label: 'Total',
            data: [],
            backgroundColor: '#ff6b6b',
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Weeknight Total Visits',
            }
        }
    }
});

// // // // // FUNCTIONS // // // // //

// // // // // UPDATE CHARTS // // // // //
function updateChart(chart, labels, data1, data2 = null, avgAge1, avgAge2 = null, predominantGender1 = null, predominantGender2 = null) {
    console.log('Updating chart with labels:', labels); // Debugging log
    console.log('Updating chart with data1:', data1); // Debugging log
    if (data2) {
        console.log('Updating chart with data2:', data2); // Debugging log
    }
    if (avgAge1) {
        console.log('Updating chart with avgAge1:', avgAge1); // Debugging log
    }
    if (avgAge2) {
        console.log('Updating chart with avgAge2:', avgAge2); // Debugging log
    }
    if (predominantGender1) {
        console.log('Updating chart with predominantGender1:', predominantGender1); // Debugging log
    }
    if (predominantGender2) {
        console.log('Updating chart with predominantGender2:', predominantGender2); // Debugging log
    }

    // Ensure avgAge1 and avgAge2 are arrays
    if (avgAge1 && typeof avgAge1 === 'object') {
        avgAge1 = Object.values(avgAge1); // Convert object to array if needed
    }
    if (avgAge2 && typeof avgAge2 === 'object') {
        avgAge2 = Object.values(avgAge2); // Convert object to array if needed
    }

    // Ensure predominantGender1 and predominantGender2 are arrays
    if (predominantGender1 && typeof predominantGender1 === 'object') {
        predominantGender1 = Object.values(predominantGender1); // Convert object to array if needed
    }
    if (predominantGender2 && typeof predominantGender2 === 'object') {
        predominantGender2 = Object.values(predominantGender2); // Convert object to array if needed
    }

    // Sort data for nationalityChart
    if (chart === nationalityChart) {
        const combined = labels.map((label, index) => ({
            label: label,
            data1: data1[index],
            data2: data2 ? data2[index] : null,
            predominantGender1: predominantGender1 ? predominantGender1[index] : null,
            predominantGender2: predominantGender2 ? predominantGender2[index] : null,
            avgAge1: avgAge1 ? avgAge1[index] : null,
            avgAge2: avgAge2 ? avgAge2[index] : null
        }));

        combined.sort((a, b) => b.data1 - a.data1);

        labels = combined.map(item => item.label);
        data1 = combined.map(item => item.data1);
        if (data2) {
            data2 = combined.map(item => item.data2);
        }
        predominantGender1 = combined.map(item => item.predominantGender1);
        predominantGender2 = combined.map(item => item.predominantGender2);
        avgAge1 = combined.map(item => item.avgAge1);
        avgAge2 = combined.map(item => item.avgAge2);
    }

    // Sort data for weeknightChart
    if (chart === weeknightChart) {
        const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const combined = labels.map((label, index) => ({
            label: label,
            data1: data1[index],
            data2: data2 ? data2[index] : null
        }));

        combined.sort((a, b) => weekOrder.indexOf(a.label) - weekOrder.indexOf(b.label));

        labels = combined.map(item => item.label);
        data1 = combined.map(item => item.data1);
        if (data2) {
            data2 = combined.map(item => item.data2);
        }
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = data1;
    chart.data.datasets[0].hidden = false;
    if (data2) {
        chart.data.datasets[1].data = data2;
        chart.data.datasets[1].hidden = false;
    } else {
        chart.data.datasets[1].hidden = true;
    }

    // Add average age data for genderChart
    if (chart === genderChart) {
        chart.data.datasets[0].avgAge = avgAge1;
        if (avgAge2) {
            chart.data.datasets[1].avgAge = avgAge2;
        }
    }

    // Add average age and predominant gender data for nationalityChart
    if (chart === nationalityChart) {
        chart.data.datasets[0].avgAge = avgAge1;
        chart.data.datasets[0].predominantGender = predominantGender1;
        if (data2) {
            chart.data.datasets[1].avgAge = avgAge2;
            chart.data.datasets[1].predominantGender = predominantGender2;
        }
    }

    chart.update();
}

function updateTextInfo(data) {
    const textInfoDiv = document.getElementById('textInfo');
    let listHTML = `
        <ul class="top-customers-list">
            <li class="top-customer-header" style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>Name</span>
                <span>Visits</span>
            </li>
    `;

    // Extract and sort the entries by visits in descending order
    const sortedCustomers = Object.entries(data.top_customers_1).sort((a, b) => b[1] - a[1]);

    // Generate the HTML for the sorted list
    for (const [name, visits] of sortedCustomers) {
        listHTML += `<li class="top-customer-item" style="display: flex; justify-content: space-between;"><span>${name}</span><span>${visits}</span></li>`;
    }

    listHTML += '</ul>';

    // Preserve the <h2> element
    textInfoDiv.innerHTML = `<h2>Top Visitors</h2>` + listHTML;
}

// Fetch and initialize the monthly visits chart
fetch('/monthly_visits')
    .then(response => response.json())
    .then(data => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const colors = ['#008080', '#db5a6b', '#32174d', '#fdff00', '#FF00FF', '#00FFFF']; // Example colors

        const datasets = Object.keys(data).map((year, index) => {
            const monthlyData = months.map(month => data[year][month] || NaN); // Fill missing months with NaN
            // Only include datasets with non-zero values
            if (monthlyData.every(value => value === 0)) return null; 
            return {
                label: year,
                data: monthlyData,
                fill: false,
                borderColor: colors[index % colors.length], // Cycle through colors
                tension: 0.1
            };
        }).filter(dataset => dataset !== null); // Remove null datasets

        // Reverse the order of datasets to ensure the most recent data appears on top
        datasets.reverse();

        const monthlyVisitsChart = new Chart(document.getElementById('frequencyLineChart'), {
            type: 'line',
            data: {
                labels: months,
                datasets: datasets
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: 'Total Visits Each Month'
                    }
                },
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Visits'
                        }
                    }
                }
            } 
        });
    });

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}