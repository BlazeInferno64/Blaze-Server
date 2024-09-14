const clearLogsBtn = document.querySelector("#clear-btn");
const downloadLogsBtn = document.querySelector("#download-btn");
const refreshLogsBtn = document.querySelector("#refresh-btn");
const logsInfo = document.querySelector("#logs-info");


clearLogsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    return clearLogs();
})

downloadLogsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    return downloadLogs();
})

refreshLogsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    return getLogs();
})

async function clearLogs() {
    try {
        const response = await fetch("/dashboard/logs/clear");
        if (!response.ok) {
            const responseBody = await response.json();
            alert(responseBody.message);
            console.error(responseBody);
            return;
        }
        const responseBody = await response.json();
        alert(responseBody.message);
        logsInfo.textContent = "Logs have been cleared successfully!\nRefresh the page again or click on 'Refresh Logs' button to see newly generated logs";
        console.log(responseBody);
    } catch (error) {
        console.error(error);
        alert("An error occurred while clearing logs: " + error.message);
    }
}

async function getLogs() {
    try {
        const response = await fetch("/dashboard/logs/get");
        if (!response.ok) {
            const responseBody = await response.json();
            alert(responseBody.message);
            console.error(responseBody);
            return;
        }
        const responseBody = await response.text();
        logsInfo.textContent = responseBody;
        return alert(`Logs have been successfully refreshed!`);
    } catch (error) {
        alert(error.message);
        return console.error(error);
    }
}

async function downloadLogs() {
    try {
        const response = await fetch("/dashboard/logs/download");
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "Server_Logs(Blaze Server).txt";
            a.click();
            return URL.revokeObjectURL(url);
        } else {
            return alert("Error downloading logs");
        }
    } catch (error) {
        console.error(error);
        return alert(error.message);
    }
}

// Add event listener to toggle dark mode
document.addEventListener('DOMContentLoaded', function () {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
    }

    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    if (toggleDarkMode) {
        toggleDarkMode.addEventListener('click', function () {
            const isDarkMode = document.body.classList.contains('dark-mode');
            document.body.classList.toggle('dark-mode');
            toggleDarkMode.textContent = isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode';
        });
    };
});