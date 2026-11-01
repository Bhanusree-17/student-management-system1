
const $ = selector => document.querySelector(selector);

let signup = false;
let current = "dashboard";
let students = [];

// API CONNECTION
const api = async (url, options = {}) => {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({
        message: "Request failed"
    }));

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
};

// MESSAGE
function toast(message) {
    $("#toast").textContent = message;
    $("#toast").style.display = "block";

    setTimeout(() => {
        $("#toast").style.display = "none";
    }, 3000);
}

// SHOW LOGIN
function showAuth() {
    $("#auth").hidden = false;
    $("#app").hidden = true;
}

// SHOW DASHBOARD
function showApp(user) {
    $("#auth").hidden = true;
    $("#app").hidden = false;

    $("#userName").textContent = user.fullName || "Account";

    loadView("dashboard");
}

// CHECK LOGIN SESSION
async function boot() {
    showAuth();

    try {
        const data = await api("/api/me");
        showApp(data.user);
    } catch (error) {
        showAuth();
    }
}

// LOGIN / SIGNUP SWITCH
$("#toggleAuth").onclick = () => {
    signup = !signup;

    $("#authTitle").textContent =
        signup ? "Create account" : "Welcome back";

    $("#authSubmit").textContent =
        signup ? "Sign up" : "Sign in";

    $("#nameWrap").hidden = !signup;

    $("#toggleAuth").textContent =
        signup
            ? "Already have an account? Sign in"
            : "Create an account";

    $("#authError").textContent = "";
};

// LOGIN AND SIGNUP
$("#authForm").onsubmit = async event => {
    event.preventDefault();

    const form = new FormData(event.target);

    const body = Object.fromEntries(form);

    const url = signup
        ? "/api/signup"
        : "/api/login";

    $("#authSubmit").disabled = true;

    try {
        const data = await api(url, {
            method: "POST",
            body: JSON.stringify(body)
        });

        $("#authError").textContent = "";

        showApp(data.user);

        event.target.reset();

    } catch (error) {
        $("#authError").textContent = error.message;

    } finally {
        $("#authSubmit").disabled = false;
    }
};

// LOGOUT
$("#logout").onclick = async () => {
    try {
        await api("/api/logout", {
            method: "POST"
        });

        showAuth();

        $("#authForm").reset();

        $("#authError").textContent = "";

        signup = false;

        $("#authTitle").textContent = "Welcome back";
        $("#authSubmit").textContent = "Sign in";
        $("#nameWrap").hidden = true;

        $("#toggleAuth").textContent = "Create an account";

        toast("Logged out successfully");

    } catch (error) {
        toast(error.message);
    }
};

// SIDEBAR
$("#menu").onclick = () => {
    $("#sidebar").classList.toggle("open");
};

// NAVIGATION
document.querySelectorAll(".nav[data-view]").forEach(button => {
    button.onclick = () => {

        document.querySelectorAll(".nav").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        $("#sidebar").classList.remove("open");

        loadView(button.dataset.view);
    };
});

// QUICK ADD
$("#quickAdd").onclick = () => {
    loadView("students");
    studentForm();
};

// LOAD PAGE
async function loadView(view) {

    current = view;

    $("#pageTitle").textContent = {
        dashboard: "Dashboard",
        students: "Students",
        marks: "Marks & performance",
        attendance: "Attendance"
    }[view] || "Dashboard";

    if (view === "dashboard") {
        return dashboard();
    }

    if (view === "students") {
        return studentPage();
    }

    if (view === "marks") {
        return marksPage();
    }

    if (view === "attendance") {
        return attendancePage();
    }
}

// DASHBOARD
async function dashboard() {

    try {

        const data = await api("/api/summary");

        $("#stats").innerHTML = [
            ["Total students", data.students],
            ["Departments", data.departments],
            ["Marks records", data.marks],
            ["Average marks", data.averagePercent + "%"]
        ].map(item => `
            <div class="stat">
                <small>${item[0]}</small>
                <strong>${item[1]}</strong>
            </div>
        `).join("");

        $("#content").innerHTML = `
            <div class="panel">
                <h2>Attendance overview</h2>

                <p>
                    <b>${data.present}</b> present
                    &nbsp;
                    <b>${data.absent}</b> absent
                    &nbsp;
                    <b>${data.late}</b> late
                </p>

                <p class="muted">
                    Attendance records: ${data.attendance}
                </p>
            </div>

            <div class="panel">
                <h2>Quick actions</h2>

                <div class="toolbar">

                    <button class="primary"
                        onclick="loadView('students');studentForm()">
                        + Add student
                    </button>

                    <button onclick="loadView('marks')">
                        Record marks
                    </button>

                    <button onclick="loadView('attendance')">
                        Mark attendance
                    </button>

                </div>
            </div>
        `;

    } catch (error) {
        toast(error.message);
    }
}

// GET STUDENTS
async function getStudents() {

    const data = await api("/api/students");

    students = data.students;

    return students;
}

// STUDENT PAGE
async function studentPage() {

    $("#stats").innerHTML = "";

    try {

        await getStudents();

        $("#content").innerHTML = `
            <div class="panel">

                <div class="toolbar">

                    <input
                        id="search"
                        placeholder="Search name, roll number or email">

                    <select id="dept">
                        <option>All departments</option>

                        ${[...new Set(students.map(s => s.department))]
                            .map(department => `
                                <option>${esc(department)}</option>
                            `).join("")}

                    </select>

                    <button class="primary" onclick="studentForm()">
                        + Add student
                    </button>

                </div>

                <div id="studentTable"></div>

            </div>
        `;

        $("#search").oninput = renderStudents;
        $("#dept").onchange = renderStudents;

        renderStudents();

    } catch (error) {
        toast(error.message);
    }
}

// DISPLAY STUDENTS
function renderStudents() {

    const query = $("#search").value.toLowerCase();

    const department = $("#dept").value;

    const rows = students.filter(student => {

        const matchesDepartment =
            department === "All departments" ||
            student.department === department;

        const matchesSearch = [
            student.fullName,
            student.rollNumber,
            student.email
        ].join(" ").toLowerCase().includes(query);

        return matchesDepartment && matchesSearch;
    });

    $("#studentTable").innerHTML = rows.length
        ? `
            <div class="tablewrap">

                <table>

                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Roll number</th>
                            <th>Department</th>
                            <th>Year</th>
                            <th>Section</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${rows.map(student => `
                            <tr>

                                <td>${esc(student.fullName)}</td>

                                <td>${esc(student.rollNumber)}</td>

                                <td>${esc(student.department)}</td>

                                <td>${esc(student.yearLevel)}</td>

                                <td>${esc(student.section || "-")}</td>

                                <td class="actions">

                                    <button onclick="studentForm(${student.id})">
                                        Edit
                                    </button>

                                    <button onclick="deleteStudent(${student.id})">
                                        Delete
                                    </button>

                                </td>

                            </tr>
                        `).join("")}

                    </tbody>

                </table>

            </div>
        `
        : `<div class="empty">No students found.</div>`;
}

// ESCAPE HTML
function esc(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

// STUDENT FORM
function studentForm(id) {

    const student = students.find(item => item.id === id) || {};

    $("#content").innerHTML = `
        <div class="panel">

            <h2>${id ? "Edit" : "Add"} student</h2>

            <form id="studentForm" class="formgrid">

                ${field("Full name", "fullName", student.fullName)}

                ${field("Roll number", "rollNumber", student.rollNumber)}

                ${field("Email", "email", student.email)}

                ${field("Phone", "phone", student.phone)}

                ${field("Department", "department", student.department)}

                <label>
                    Academic year

                    <select name="yearLevel">

                        <option>${esc(student.yearLevel || "1st Year")}</option>

                        ${["1st Year", "2nd Year", "3rd Year", "4th Year"]
                            .filter(year => year !== student.yearLevel)
                            .map(year => `<option>${year}</option>`)
                            .join("")}

                    </select>

                </label>

                ${field("Section", "section", student.section)}

                <label>
                    Gender

                    <select name="gender">

                        <option>${esc(student.gender || "Female")}</option>

                        ${["Female", "Male", "Other"]
                            .filter(gender => gender !== student.gender)
                            .map(gender => `<option>${gender}</option>`)
                            .join("")}

                    </select>

                </label>

                <button class="primary">
                    ${id ? "Update" : "Save"} student
                </button>

                <button type="button" onclick="loadView('students')">
                    Cancel
                </button>

            </form>

        </div>
    `;

    $("#studentForm").onsubmit = async event => {

        event.preventDefault();

        const body = Object.fromEntries(
            new FormData(event.target)
        );

        try {

            await api(
                id ? `/api/students/${id}` : "/api/students",
                {
                    method: id ? "PUT" : "POST",
                    body: JSON.stringify(body)
                }
            );

            toast("Student saved");

            loadView("students");

        } catch (error) {
            toast(error.message);
        }
    };
}

// FORM FIELD
function field(label, name, value = "") {

    return `
        <label>
            ${label}

            <input
                name="${name}"
                value="${esc(value || "")}">
        </label>
    `;
}

// DELETE STUDENT
async function deleteStudent(id) {

    if (!confirm("Delete this student? Their marks and attendance records will also be deleted.")) {
        return;
    }

    try {

        await api(`/api/students/${id}`, {
            method: "DELETE"
        });

        toast("Student deleted");

        studentPage();

    } catch (error) {
        toast(error.message);
    }
}

// MARKS PAGE
async function marksPage() {

    $("#stats").innerHTML = "";

    try {

        await getStudents();

        const data = await api("/api/marks");

        $("#content").innerHTML = `
            <div class="panel">

                <h2>Record marks</h2>

                <form id="marksForm" class="formgrid">

                    <label>
                        Student

                        <select name="studentId" required>

                            ${students.map(student => `
                                <option value="${student.id}">
                                    ${esc(student.fullName)}
                                    (${esc(student.rollNumber)})
                                </option>
                            `).join("")}

                        </select>

                    </label>

                    ${field("Subject", "subject")}

                    ${field("Exam name", "examName")}

                    <label>
                        Maximum marks

                        <input
                            name="maxMarks"
                            type="number"
                            min="1"
                            value="100"
                            required>
                    </label>

                    <label>
                        Obtained marks

                        <input
                            name="obtainedMarks"
                            type="number"
                            min="0"
                            step=".01"
                            required>
                    </label>

                    <label>
                        Exam date

                        <input
                            name="examDate"
                            type="date">
                    </label>

                    <button class="primary">
                        Save marks
                    </button>

                </form>

            </div>

            <div class="panel">

                <h2>Academic records</h2>

                <div class="tablewrap" id="marksTable"></div>

            </div>
        `;

        $("#marksForm").onsubmit = async event => {

            event.preventDefault();

            try {

                await api("/api/marks", {
                    method: "POST",
                    body: JSON.stringify(
                        Object.fromEntries(new FormData(event.target))
                    )
                });

                toast("Marks saved");

                marksPage();

            } catch (error) {
                toast(error.message);
            }
        };

        $("#marksTable").innerHTML = data.marks.length
            ? `
                <table>

                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Subject</th>
                            <th>Exam</th>
                            <th>Score</th>
                            <th>Percentage</th>
                            <th></th>
                        </tr>
                    </thead>

                    <tbody>

                        ${data.marks.map(mark => `
                            <tr>

                                <td>
                                    ${esc(mark.fullName)}
                                    <br>
                                    <small>${esc(mark.rollNumber)}</small>
                                </td>

                                <td>${esc(mark.subject)}</td>

                                <td>${esc(mark.examName)}</td>

                                <td>
                                    ${mark.obtainedMarks}/${mark.maxMarks}
                                </td>

                                <td>
                                    <span class="badge">
                                        ${(mark.obtainedMarks / mark.maxMarks * 100).toFixed(1)}%
                                    </span>
                                </td>

                                <td>
                                    <button onclick="deleteMark(${mark.id})">
                                        Delete
                                    </button>
                                </td>

                            </tr>
                        `).join("")}

                    </tbody>

                </table>
            `
            : `<div class="empty">No marks recorded.</div>`;

    } catch (error) {
        toast(error.message);
    }
}

// DELETE MARK
async function deleteMark(id) {

    if (!confirm("Delete this marks record?")) {
        return;
    }

    try {

        await api(`/api/marks/${id}`, {
            method: "DELETE"
        });

        toast("Marks deleted");

        marksPage();

    } catch (error) {
        toast(error.message);
    }
}

// ATTENDANCE PAGE
async function attendancePage() {

    $("#stats").innerHTML = "";

    try {

        await getStudents();

        const date = new Date().toISOString().slice(0, 10);

        const data = await api(`/api/attendance?date=${date}`);

        $("#content").innerHTML = `
            <div class="panel">

                <h2>Mark attendance</h2>

                <form id="attendanceForm" class="formgrid">

                    <label>
                        Student

                        <select name="studentId" required>

                            ${students.map(student => `
                                <option value="${student.id}">
                                    ${esc(student.fullName)}
                                    (${esc(student.rollNumber)})
                                </option>
                            `).join("")}

                        </select>

                    </label>

                    <label>
                        Date

                        <input
                            name="attendanceDate"
                            type="date"
                            value="${date}"
                            required>
                    </label>

                    <label>
                        Status

                        <select name="status">
                            <option>Present</option>
                            <option>Absent</option>
                            <option>Late</option>
                        </select>

                    </label>

                    ${field("Remarks", "remarks")}

                    <button class="primary">
                        Save attendance
                    </button>

                </form>

            </div>

            <div class="panel">

                <h2>Attendance for ${date}</h2>

                <div class="tablewrap" id="attTable"></div>

            </div>
        `;

        $("#attendanceForm").onsubmit = async event => {

            event.preventDefault();

            try {

                await api("/api/attendance", {
                    method: "POST",
                    body: JSON.stringify(
                        Object.fromEntries(new FormData(event.target))
                    )
                });

                toast("Attendance saved");

                attendancePage();

            } catch (error) {
                toast(error.message);
            }
        };

        $("#attTable").innerHTML = data.attendance.length
            ? `
                <table>

                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Roll number</th>
                            <th>Status</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${data.attendance.map(item => `
                            <tr>

                                <td>${esc(item.fullName)}</td>

                                <td>${esc(item.rollNumber)}</td>

                                <td>
                                    <span class="badge">
                                        ${esc(item.status)}
                                    </span>
                                </td>

                                <td>${esc(item.remarks || "-")}</td>

                            </tr>
                        `).join("")}

                    </tbody>

                </table>
            `
            : `<div class="empty">No attendance recorded for today.</div>`;

    } catch (error) {
        toast(error.message);
    }
}

// START APPLICATION
boot();
