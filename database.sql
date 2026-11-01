CREATE DATABASE IF NOT EXISTS student_management;
USE student_management;
CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL,
 email VARCHAR(150) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS students (
 id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL,
 roll_number VARCHAR(50) NOT NULL UNIQUE, email VARCHAR(150), phone VARCHAR(20),
 department VARCHAR(100) NOT NULL, year_level VARCHAR(20) NOT NULL,
 section VARCHAR(20), gender VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS marks (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL,
 subject VARCHAR(100) NOT NULL, exam_name VARCHAR(100) NOT NULL,
 max_marks DECIMAL(7,2) NOT NULL DEFAULT 100, obtained_marks DECIMAL(7,2) NOT NULL,
 exam_date DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY unique_student_exam_subject(student_id, exam_name, subject),
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS attendance (
 id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL,
 attendance_date DATE NOT NULL, status ENUM('Present','Absent','Late') NOT NULL DEFAULT 'Present',
 remarks VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY unique_student_day(student_id, attendance_date),
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
