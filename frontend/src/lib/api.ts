/**
 * API Client for GyanBrige LMS
 */

const API_BASE = '/api';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  teacherId: string;
  teacherName?: string;
  lectureCount?: number;
  enrolled?: boolean;
  progress?: number;
  studentCount?: number;
}

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number;
  notes: string;
  order: number;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
  completedLectures: string[];
  course?: Course;
}

// Helper
export function getStoredUser(): { id: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('user') ?? ''); } catch { return null; }
}

/** fetch wrapper that automatically attaches x-user-id/x-user-role headers */
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const user = getStoredUser();
  const isFormData = options.body instanceof FormData;
  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(user ? { 'x-user-id': user.id, 'x-user-role': user.role } : {}),
      ...options.headers,
    },
  });
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const user = getStoredUser();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { 'x-user-id': user.id, 'x-user-role': user.role } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }

  const data = await res.json();
  return data;
}

// Auth
export const auth = {
  login: async (email: string, password: string): Promise<{ user: User }> => {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signup: async (
    name: string,
    email: string,
    password: string,
    role: 'student' | 'teacher'
  ): Promise<{ user: User }> => {
    return fetchAPI('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
  },
};

// Courses
export const coursesApi = {
  getAll: async (userId?: string): Promise<{ courses: Course[] }> => {
    const params = userId ? `?userId=${userId}` : '';
    return fetchAPI(`/courses${params}`);
  },

  getById: async (id: string, userId?: string): Promise<{ course: Course & { lectures?: Lecture[] } }> => {
    const params = userId ? `?userId=${userId}` : '';
    return fetchAPI(`/courses/${id}${params}`);
  },

  create: async (course: Partial<Course>): Promise<{ course: Course }> => {
    return fetchAPI('/courses', {
      method: 'POST',
      body: JSON.stringify(course),
    });
  },

  update: async (id: string, updates: Partial<Course>): Promise<{ course: Course }> => {
    return fetchAPI(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    return fetchAPI(`/courses/${id}`, { method: 'DELETE' });
  },
};

// Enrollments
export const enrollmentsApi = {
  getByUser: async (userId: string): Promise<{ enrollments: Enrollment[] }> => {
    return fetchAPI(`/enrollments?userId=${userId}`);
  },

  getByCourse: async (courseId: string): Promise<{ enrollments: (Enrollment & { userName: string; userEmail: string })[] }> => {
    return fetchAPI(`/enrollments?courseId=${courseId}`);
  },

  enroll: async (userId: string, courseId: string): Promise<{ enrollment: Enrollment }> => {
    return fetchAPI('/enrollments', {
      method: 'POST',
      body: JSON.stringify({ userId, courseId }),
    });
  },

  unenroll: async (userId: string, courseId: string): Promise<{ success: boolean }> => {
    return fetchAPI(`/enrollments?userId=${userId}&courseId=${courseId}`, {
      method: 'DELETE',
    });
  },
};

// Progress
export const progressApi = {
  markComplete: async (
    userId: string,
    courseId: string,
    lectureId: string
  ): Promise<{ enrollment: Enrollment }> => {
    return fetchAPI('/progress', {
      method: 'POST',
      body: JSON.stringify({ userId, courseId, lectureId }),
    });
  },
};

export default { auth, coursesApi, enrollmentsApi, progressApi };
