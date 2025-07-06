let currentUser = null;
let allExpenses = [];

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("tracker-container").style.display = "block";
    showExpenses();
  } else {
    currentUser = null;
    document.getElementById("auth-container").style.display = "block";
    document.getElementById("tracker-container").style.display = "none";
  }
});

// Login
document.getElementById("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(err => console.error(err));
});

// Signup
document.getElementById("signup-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .catch(err => console.error(err));
});
const googleProvider = new firebase.auth.GoogleAuthProvider();

document.getElementById('google-login').addEventListener('click', () => {
  firebase.auth().signInWithPopup(googleProvider)
    .then((result) => {
      const user = result.user;
      console.log("Google Login Success:", user);
      // You can show welcome message or redirect if needed
    })
    .catch((error) => {
      console.error("Google Login Failed:", error);
    });
});

document.getElementById("show-signup").addEventListener("click", () => {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("signup-form").style.display = "block";
  document.getElementById("show-login").style.display = "inline";
});

document.getElementById("show-login").addEventListener("click", () => {
  document.getElementById("signup-form").style.display = "none";
  document.getElementById("login-form").style.display = "block";
  document.getElementById("show-login").style.display = "none";
});

// Add Expense
document.getElementById("expense-form").addEventListener("submit", e => {
  e.preventDefault();
  if (!currentUser) return;

  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const date = document.getElementById("date").value;

  if (!amount || !category || !date) return;

  db.collection("expenses").add({
    amount,
    category,
    date,
    user: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById("expense-form").reset();
    showExpenses();
  }).catch(err => console.error("Error adding expense:", err));
});

// Show Expenses
function showExpenses() {
  if (!currentUser) return;

  db.collection("expenses")
    .where("user", "==", currentUser.uid)
    .orderBy("date", "desc")  
    .get()
    .then(snapshot => {
      const list = document.getElementById("expense-list");
      list.innerHTML = "";
      let total = 0;
      allExpenses = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        allExpenses.push({ id: doc.id, ...data });

        const li = document.createElement("li");
        li.className = "bg-gray-100 p-3 my-2 rounded-md flex justify-between items-center";
li.innerHTML = `
  <div>
    <strong>₹${data.amount}</strong> - ${data.category} - ${data.date}
  </div>
  <button onclick="deleteExpense('${doc.id}')" title="Delete" style="border:none; background:none; cursor:pointer;">
  <i class="fas fa-trash"></i>
</button>

`;

        list.appendChild(li);

        total += data.amount;
      });

      document.getElementById("total").innerText = `🧾 Total Spent: ₹${total}`;
      renderCharts(allExpenses);
    })
    .catch(err => console.error(err));
}

// Delete
function deleteExpense(id) {
  db.collection("expenses").doc(id).delete().then(showExpenses);
}

// Filters
document.getElementById("filter-category").addEventListener("change", filterExpenses);
document.getElementById("filter-month").addEventListener("change", filterExpenses);
document.getElementById("clear-filters").addEventListener("click", () => {
  document.getElementById("filter-category").value = "all";
  document.getElementById("filter-month").value = "all";
  showExpenses();
});

function filterExpenses() {
  const cat = document.getElementById("filter-category").value;
  const month = document.getElementById("filter-month").value;
  const list = document.getElementById("expense-list");
  list.innerHTML = "";

  let filtered = [...allExpenses];

  if (cat !== "all") filtered = filtered.filter(e => e.category === cat);
  if (month !== "all") filtered = filtered.filter(e => new Date(e.date).toLocaleString("default", { month: "short" }) === month);

  let total = 0;
  filtered.forEach(exp => {
    const li = document.createElement("li");
    li.innerHTML = `₹${exp.amount} - ${exp.category} - ${exp.date} <button onclick="deleteExpense('${exp.id}')">Delete</button>`;
    list.appendChild(li);
    total += exp.amount;
  });

  document.getElementById("total").innerText = `🧾 Total Spent: ₹${total}`;
  renderCharts(filtered);
}

// CSV Export
function downloadCSV() {
  let csv = "Amount,Category,Date\n";
  allExpenses.forEach(exp => {
    csv += `${exp.amount},${exp.category},${exp.date}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "expenses.csv";
  link.click();
}

// Charts
function renderCharts(data) {
  const pieCtx = document.getElementById("expense-chart").getContext("2d");
  const barCtx = document.getElementById("bar-chart").getContext("2d");

   const catMap = {};
data.forEach(e => {
  catMap[e.category] = (catMap[e.category] || 0) + e.amount;
});

  const monthMap = {};
data.forEach(e => {
  const date = new Date(e.date);
  const monthKey = `${date.getFullYear()}-${date.getMonth()}`; // Unique key: "2025-6"
  const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" }); // "Jul 2025"
  if (!monthMap[monthKey]) {
    monthMap[monthKey] = { label: monthLabel, total: 0 };
  }
  monthMap[monthKey].total += e.amount;
});

// ✅ Sort keys in ascending order (old to new)
const sortedMonths = Object.keys(monthMap).sort((a, b) => a.localeCompare(b));
const monthLabels = sortedMonths.map(k => monthMap[k].label);
const monthValues = sortedMonths.map(k => monthMap[k].total);
// 🌙 Detect current theme and apply color settings
const isDarkMode = document.body.classList.contains("dark-mode");
const textColor = isDarkMode ? "#f5f5f5" : "#333";      // Axis labels + ticks
const gridColor = isDarkMode ? "#555" : "#ccc";         // Grid lines

if (window.pieChart) window.pieChart.destroy();
if (window.barChart) window.barChart.destroy();

window.pieChart = new Chart(pieCtx, {
  type: "pie",
  data: {
    labels: Object.keys(catMap),
    datasets: [{
      data: Object.values(catMap),
      backgroundColor: ["#f39c12", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"]
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,  // use variable
          font: {
            size: 14
          }
        }
      },
      tooltip: {
        bodyColor: isDarkMode ? "#fff" : "#000",
        backgroundColor: isDarkMode ? "#333" : "#fff",
        titleColor: isDarkMode ? "#fff" : "#000"
      }
    }
  }
});



window.barChart = new Chart(barCtx, {
  type: "bar",
  data: {
    labels: monthLabels,
    datasets: [{
      label: "Amount Spent",
      data: monthValues,
      backgroundColor: "#4a90e2"
    }]
  },
  options: {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            return `₹${context.parsed.y}`;
          }
        }
      },
      legend: {
        labels: {
          color: textColor
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function(value) {
            return `₹${value}`;
          },
          color: textColor
        },
        grid: {
          color: gridColor
        }
      },
      x: {
        ticks: {
          color: textColor
        },
        grid: {
          color: gridColor
        }
      }
    }
  }
});
}
const logoutBtn = document.getElementById('logout-btn');

// Show the logout button if user is logged in
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    logoutBtn.style.display = 'block';
  } else {
    logoutBtn.style.display = 'none';
  }
});

// 🧼 Logout on click with confirmation
logoutBtn.addEventListener('click', () => {
  if (confirm("Are you sure you want to logout?")) {
    firebase.auth().signOut().then(() => {
      alert("Logged out successfully!");
      location.reload(); // Refresh to show login page
    }).catch((error) => {
      console.error("Logout error:", error);
    });
  }
});
// ✅ Light/Dark Theme Toggle without DOMContentLoaded
const toggleThemeBtn = document.getElementById("toggle-theme");
if (toggleThemeBtn) {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.classList.add(`${savedTheme}-mode`);
  toggleThemeBtn.textContent = savedTheme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";

  toggleThemeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    document.body.classList.toggle("light-mode");

    const newTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
    localStorage.setItem("theme", newTheme);
    toggleThemeBtn.textContent = newTheme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";

    renderCharts(allExpenses); // re-render charts with new theme colors
  });
}
