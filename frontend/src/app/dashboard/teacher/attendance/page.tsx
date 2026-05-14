'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  name: string;
  icon: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
}

interface AttendanceRecord {
  [studentId: string]: 'present' | 'absent' | 'late';
}

interface UserData {
  id: string;
  name: string;
  role: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'teacher') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadCourses(parsed.id);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadCourses = async (teacherId: string) => {
    try {
      const res = await fetch(`/api/courses?teacherId=${teacherId}`);
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (courseId: string) => {
    try {
      const res = await fetch(`/api/enrollments?courseId=${courseId}`);
      const data = await res.json();
      // Extract students from enrollments
      const enrolledStudents = data.enrollments?.map((e: { userName: string; userEmail: string; userId: string }) => ({
        id: e.userId,
        name: e.userName,
        email: e.userEmail,
      })) || [];
      setStudents(enrolledStudents);
      
      // Initialize attendance (default to absent)
      const initialAttendance: AttendanceRecord = {};
      enrolledStudents.forEach((s: Student) => {
        initialAttendance[s.id] = 'absent';
      });
      setAttendance(initialAttendance);
      
      // Load existing attendance for the date
      loadAttendance(courseId, selectedDate);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  const loadAttendance = async (courseId: string, date: string) => {
    try {
      const res = await fetch(`/api/attendance?courseId=${courseId}&date=${date}`);
      const data = await res.json();
      if (data.attendance?.records) {
        setAttendance(data.attendance.records);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      loadStudents(selectedCourse);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedCourse && selectedDate) {
      loadAttendance(selectedCourse, selectedDate);
    }
  }, [selectedDate]);

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAllPresent = () => {
    const newAttendance: AttendanceRecord = {};
    students.forEach(s => { newAttendance[s.id] = 'present'; });
    setAttendance(newAttendance);
    setSaved(false);
  };

  const markAllAbsent = () => {
    const newAttendance: AttendanceRecord = {};
    students.forEach(s => { newAttendance[s.id] = 'absent'; });
    setAttendance(newAttendance);
    setSaved(false);
  };

  const saveAttendance = async () => {
    if (!selectedCourse || !user) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          date: selectedDate,
          records: attendance,
          markedBy: user.id,
        }),
      });

      if (res.ok) {
        setSaved(true);
      }
    } catch (err) {
      console.error('Failed to save attendance:', err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'late': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'absent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-white/10 text-white/50';
    }
  };

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const lateCount = Object.values(attendance).filter(s => s === 'late').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📋</div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Back Button */}
      <Link 
        href="/dashboard/teacher" 
        className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📋 Mark Attendance</h1>
        <p className="text-white/60">Track student attendance for your courses</p>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">Select Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="input-glass"
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.icon} {course.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-glass"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {selectedCourse && students.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{presentCount}</div>
              <div className="text-white/60 text-sm">Present</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{lateCount}</div>
              <div className="text-white/60 text-sm">Late</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{absentCount}</div>
              <div className="text-white/60 text-sm">Absent</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-4 mb-6">
            <button onClick={markAllPresent} className="glass px-4 py-2 rounded-xl hover:bg-emerald-500/20 transition">
              ✅ Mark All Present
            </button>
            <button onClick={markAllAbsent} className="glass px-4 py-2 rounded-xl hover:bg-red-500/20 transition">
              ❌ Mark All Absent
            </button>
          </div>

          {/* Student List */}
          <div className="glass rounded-2xl overflow-hidden mb-6">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-semibold">Students ({students.length})</h2>
            </div>
            <div className="divide-y divide-white/10">
              {students.map((student) => (
                <div key={student.id} className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span>🎓</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{student.name}</h4>
                    <p className="text-white/50 text-sm">{student.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {(['present', 'late', 'absent'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleAttendanceChange(student.id, status)}
                        className={`px-3 py-1 rounded-lg border text-sm transition ${
                          attendance[student.id] === status
                            ? getStatusColor(status)
                            : 'border-white/10 text-white/50 hover:border-white/30'
                        }`}
                      >
                        {status === 'present' ? '✓ Present' : status === 'late' ? '⏰ Late' : '✗ Absent'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveAttendance}
            disabled={saving}
            className={`btn-primary w-full py-4 text-lg ${saved ? 'bg-emerald-600' : ''}`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Saving...
              </span>
            ) : saved ? (
              '✅ Attendance Saved!'
            ) : (
              '💾 Save Attendance'
            )}
          </button>
        </>
      )}

      {selectedCourse && students.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <span className="text-4xl block mb-4">📭</span>
          <h3 className="text-xl font-semibold mb-2">No Students Enrolled</h3>
          <p className="text-white/60">No students have enrolled in this course yet.</p>
        </div>
      )}

      {!selectedCourse && (
        <div className="glass rounded-2xl p-8 text-center">
          <span className="text-4xl block mb-4">👆</span>
          <h3 className="text-xl font-semibold mb-2">Select a Course</h3>
          <p className="text-white/60">Choose a course above to mark attendance</p>
        </div>
      )}
    </div>
  );
}
