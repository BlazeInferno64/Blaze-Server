const form = document.querySelector("#login-form");
const button = document.querySelector("#btn");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.querySelector("#username").value;
  const password = document.querySelector("#password").value;
  sendRequestInfo(username, password);
  button.innerText = `Logging in...`;
});

async function sendRequestInfo(username, password) {
  try {
    const response = await fetch("/oauth", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const responseBody = await response.json();
    if (response.status >= 400 && response.status <= 500) {
        alert(responseBody.message);
        button.innerText = `Login`;
    }
    if (response.status >= 200 && response.status <= 300) {
        alert(responseBody.message);
        button.innerText = `Redirecting...`;
        setTimeout(() => {
          window.location.href = `/dashboard`; // Redirect to /dashboard on successful login
          return button.innerText = `Login`;
        }, 2000);
    }
  } catch (error) {
    button.innerText = `Login`;
    console.error(error);
    return alert(error.message);
  }
}