require("dotenv").config();
const express=require("express"), session=require("express-session"), bcrypt=require("bcryptjs"), mysql=require("mysql2/promise"), path=require("path");
const app=express(), PORT=process.env.PORT||3000;
app.use(express.json()); app.use(express.urlencoded({extended:true})); app.use(express.static(path.join(__dirname,"public")));
app.use(session({secret:process.env.SESSION_SECRET||"change-this-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}}));
const pool=mysql.createPool({host:process.env.DB_HOST||"localhost",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"student_management",waitForConnections:true,connectionLimit:10});
const clean=v=>String(v??"").trim(), auth=(req,res,next)=>req.session.userId?next():res.status(401).json({message:"Please sign in first."});

app.post("/api/signup", async (req, res) => {
  try {
    const name = clean(req.body.fullName);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || password.length < 6) {
      return res.status(400).json({
        message: "Enter name, email and password (minimum 6 characters)."
      });
    }

    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Email already registered. Please sign in."
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, hash]
    );

    req.session.userId = result.insertId;
    req.session.userName = name;

    res.json({
      message: "Account created successfully",
      user: {
        id: result.insertId,
        fullName: name,
        email: email
      }
    });

  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    res.status(500).json({
      message: "Signup failed. Please try again."
    });
  }
});


app.post("/api/login", async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Enter email and password."
      });
    }

    const [rows] = await pool.execute(
      "SELECT id, full_name, email, password_hash FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Account not found. Please sign up."
      });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Incorrect password."
      });
    }

    req.session.userId = user.id;
    req.session.userName = user.full_name;

    res.json({
      message: "Signed in successfully",
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: "Login failed. Please try again."
    });
  }
});

app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({message:"Logged out"})));
app.get("/api/me",auth,(req,res)=>res.json({user:{id:req.session.userId,fullName:req.session.userName}}));
app.get("/api/students",auth,async(req,res)=>{try{let dept=clean(req.query.department),search=clean(req.query.search),sql="SELECT id,full_name AS fullName,roll_number AS rollNumber,email,phone,department,year_level AS yearLevel,section,gender,created_at AS createdAt FROM students WHERE 1=1",a=[];if(dept&&dept!=="All departments"){sql+=" AND department=?";a.push(dept);}if(search){sql+=" AND (full_name LIKE ? OR roll_number LIKE ? OR email LIKE ?)";a.push(`%${search}%`,`%${search}%`,`%${search}%`);}sql+=" ORDER BY full_name";let [students]=await pool.execute(sql,a);res.json({students});}catch(e){console.error("STUDENTS:",e);res.status(500).json({message:e.message});}});
app.post("/api/students",auth,async(req,res)=>{let s=req.body,v=[clean(s.fullName),clean(s.rollNumber),clean(s.email),clean(s.phone),clean(s.department),clean(s.yearLevel),clean(s.section),clean(s.gender)];if(!v[0]||!v[1]||!v[4]||!v[5])return res.status(400).json({message:"Name, roll number, department and year required."});try{let [r]=await pool.execute("INSERT INTO students(full_name,roll_number,email,phone,department,year_level,section,gender) VALUES(?,?,?,?,?,?,?,?)",v);res.status(201).json({message:"Student added",id:r.insertId});}catch(e){console.error("ADD STUDENT:",e);res.status(e.code==="ER_DUP_ENTRY"?409:500).json({message:e.code==="ER_DUP_ENTRY"?"Roll number already exists.":e.message});}});
app.put("/api/students/:id",auth,async(req,res)=>{let s=req.body,v=[clean(s.fullName),clean(s.rollNumber),clean(s.email),clean(s.phone),clean(s.department),clean(s.yearLevel),clean(s.section),clean(s.gender),Number(req.params.id)];try{await pool.execute("UPDATE students SET full_name=?,roll_number=?,email=?,phone=?,department=?,year_level=?,section=?,gender=? WHERE id=?",v);res.json({message:"Student updated"});}catch(e){res.status(500).json({message:e.message});}});
app.delete("/api/students/:id",auth,async(req,res)=>{try{await pool.execute("DELETE FROM students WHERE id=?",[Number(req.params.id)]);res.json({message:"Student deleted"});}catch(e){res.status(500).json({message:e.message});}});
app.get("/api/marks",auth,async(req,res)=>{try{let [rows]=await pool.execute("SELECT m.id,m.student_id AS studentId,s.full_name AS fullName,s.roll_number AS rollNumber,m.subject,m.exam_name AS examName,m.max_marks AS maxMarks,m.obtained_marks AS obtainedMarks,m.exam_date AS examDate FROM marks m JOIN students s ON s.id=m.student_id ORDER BY m.exam_date DESC,m.id DESC");res.json({marks:rows});}catch(e){console.error(e);res.status(500).json({message:e.message});}});
app.post("/api/marks",auth,async(req,res)=>{let s=req.body,student=Number(s.studentId),subject=clean(s.subject),exam=clean(s.examName),max=Number(s.maxMarks),obt=Number(s.obtainedMarks),date=clean(s.examDate)||null;if(!student||!subject||!exam||!Number.isFinite(max)||max<=0||!Number.isFinite(obt)||obt<0||obt>max)return res.status(400).json({message:"Enter valid student, subject, exam and marks (obtained cannot exceed maximum)."});try{let [r]=await pool.execute("INSERT INTO marks(student_id,subject,exam_name,max_marks,obtained_marks,exam_date) VALUES(?,?,?,?,?,?)",[student,subject,exam,max,obt,date]);res.status(201).json({message:"Marks saved",id:r.insertId});}catch(e){console.error(e);res.status(e.code==="ER_DUP_ENTRY"?409:500).json({message:e.code==="ER_DUP_ENTRY"?"Marks for this student, exam and subject already exist.":e.message});}});
app.delete("/api/marks/:id",auth,async(req,res)=>{try{await pool.execute("DELETE FROM marks WHERE id=?",[Number(req.params.id)]);res.json({message:"Marks deleted"});}catch(e){res.status(500).json({message:e.message});}});
app.get("/api/attendance",auth,async(req,res)=>{try{let date=clean(req.query.date);let sql="SELECT a.id,a.student_id AS studentId,s.full_name AS fullName,s.roll_number AS rollNumber,a.attendance_date AS attendanceDate,a.status,a.remarks FROM attendance a JOIN students s ON s.id=a.student_id",args=[];if(date){sql+=" WHERE a.attendance_date=?";args.push(date);}sql+=" ORDER BY a.attendance_date DESC,s.full_name";let [rows]=await pool.execute(sql,args);res.json({attendance:rows});}catch(e){console.error(e);res.status(500).json({message:e.message});}});
app.post("/api/attendance",auth,async(req,res)=>{let s=req.body,student=Number(s.studentId),date=clean(s.attendanceDate),status=clean(s.status),remarks=clean(s.remarks);if(!student||!date||!["Present","Absent","Late"].includes(status))return res.status(400).json({message:"Choose student, date and attendance status."});try{await pool.execute("INSERT INTO attendance(student_id,attendance_date,status,remarks) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),remarks=VALUES(remarks)",[student,date,status,remarks]);res.json({message:"Attendance saved"});}catch(e){console.error(e);res.status(500).json({message:e.message});}});
app.get("/api/summary",auth,async(req,res)=>{try{let [[a]] = await pool.execute("SELECT COUNT(*) totalStudents,COUNT(DISTINCT department) departments FROM students");let [[m]]=await pool.execute("SELECT COUNT(*) totalMarks,ROUND(AVG(obtained_marks/max_marks*100),1) averagePercent FROM marks");let [[t]]=await pool.execute("SELECT COUNT(*) totalRecords,SUM(status='Present') present,SUM(status='Absent') absent,SUM(status='Late') late FROM attendance");res.json({students:a.totalStudents,departments:a.departments,marks:m.totalMarks,averagePercent:m.averagePercent||0,attendance:t.totalRecords||0,present:t.present||0,absent:t.absent||0,late:t.late||0});}catch(e){res.status(500).json({message:e.message});}});
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.listen(PORT,()=>console.log(`Student dashboard running on port ${PORT}`));
