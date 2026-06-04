'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { coursesApi, enrollmentsApi, type Course } from '@/lib/api';

interface LectureItem {
  id: string;
  title: string;
  duration: string;
  order: number;
  description?: string;
  videoUrl?: string;
}

interface CourseDetail extends Course {
  lectures?: LectureItem[];
}

interface UserData {
  id: string;
  name: string;
  role: string;
  email: string;
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  
  const [user, setUser] = useState<UserData | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.role !== 'student') {
        router.push('/login');
      } else {
        setUser(parsed);
        loadCourse(parsed.id);
      }
    } else {
      router.push('/login');
    }
  }, [router, courseId]);

  const loadCourse = async (userId: string) => {
    try {
      const res = await coursesApi.getById(courseId, userId);
      setCourse(res.course as unknown as CourseDetail);
    } catch (error) {
      console.error('Failed to load course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!user) return;
    setEnrolling(true);
    try {
      await enrollmentsApi.enroll(user.id, courseId);
      loadCourse(user.id);
    } catch (error) {
      console.error('Failed to enroll:', error);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">📚</div>
          <p className="text-white/60">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-white/60">Course not found</p>
          <Link href="/dashboard/student" className="text-emerald-400 mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Back Button */}
      <Link 
        href="/dashboard/student" 
        className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition"
      >
        ← Back to Dashboard
      </Link>

      {/* Course Header */}
      <div className="glass rounded-2xl p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${course.color} flex items-center justify-center shrink-0`}>
            <span className="text-5xl">{course.icon}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
                <p className="text-white/60">{course.description}</p>
              </div>
              {!course.enrolled ? (
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="btn-primary px-6 py-3 rounded-xl disabled:opacity-50"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </button>
              ) : (
                <span className="text-emerald-400 flex items-center gap-2 glass px-4 py-2 rounded-xl">
                  ✓ Enrolled
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="glass px-3 py-1 rounded-full">👨‍🏫 {course.teacherName}</span>
              <span className="glass px-3 py-1 rounded-full">📹 {course.lectureCount} Lectures</span>
              {course.enrolled && (
                <span className="glass px-3 py-1 rounded-full">📊 {course.progress}% Complete</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {course.enrolled && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Your Progress</span>
              <span className="font-medium">{course.progress}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${course.color} transition-all duration-500`}
                style={{ width: `${course.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lectures List */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Course Content</h2>
          <p className="text-white/60 text-sm">{course.lectures?.length || 0} lectures</p>
        </div>
        
        {course.lectures && course.lectures.length > 0 ? (
          <div className="divide-y divide-white/10">
            {course.lectures.map((lecture, i) => (
              course.enrolled ? (
                <Link
                  key={lecture.id}
                  href={`/dashboard/student/lecture/${lecture.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-white/5 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{lecture.title}</h4>
                    {lecture.description && (
                      <p className="text-white/50 text-sm">{lecture.description}</p>
                    )}
                  </div>
                  <span className="text-white/50 text-sm">{lecture.duration}</span>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    ▶
                  </div>
                </Link>
              ) : (
                <div
                  key={lecture.id}
                  className="flex items-center gap-4 p-4 opacity-60"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{lecture.title}</h4>
                    {lecture.description && (
                      <p className="text-white/50 text-sm">{lecture.description}</p>
                    )}
                  </div>
                  <span className="text-white/50 text-sm">{lecture.duration}</span>
                  <span className="text-white/30">🔒</span>
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-white/50">
            <span className="text-4xl block mb-2">📭</span>
            No lectures available yet
          </div>
        )}
      </div>

      {/* Enroll CTA */}
      {!course.enrolled && (
        <div className="glass rounded-2xl p-8 mt-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Ready to start learning?</h3>
          <p className="text-white/60 mb-4">Enroll now to access all lectures and track your progress</p>
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="btn-primary px-8 py-3 rounded-xl text-lg disabled:opacity-50"
          >
            {enrolling ? 'Enrolling...' : 'Enroll in This Course'}
          </button>
        </div>
      )}
    </div>
  );
}
