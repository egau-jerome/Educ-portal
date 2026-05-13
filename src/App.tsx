/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  query,
  where,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable
} from 'firebase/storage';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  ClipboardCheck, 
  FileText, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit, 
  ChevronRight,
  Search,
  Filter,
  School,
  UserCircle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  UserCog,
  User,
  Camera,
  Upload,
  X,
  Zap,
  Settings,
  Image as ImageIcon,
  TrendingUp,
  Award,
  UserCheck,
  UserX,
  Save,
  Check,
  Calendar,
  Clock,
  Printer,
  ChevronLeft,
  MessageSquare,
  FileDown,
  LayoutGrid,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  IdCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2pdf from 'html2pdf.js';
import { QRCodeCanvas } from 'qrcode.react';
import { auth, db, storage, handleFirestoreError, OperationType, isConfigValid } from './firebase';

// --- Types ---

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  subjects?: string[];
  status?: 'active' | 'disabled' | 'pending';
  studentId?: string;
  teacherId?: string;
}

interface Student {
  id: string;
  name: string;
  classId: string;
  curriculum: 'lower' | 'advanced';
  registrationNumber?: string;
  photoUrl?: string;
  subjectIds?: string[];
  combination?: string;
}

interface Attendance {
  id?: string;
  studentId: string;
  type: 'examination' | 'class';
  date: string;
  status: 'present' | 'absent' | 'late';
  subjectId?: string;
  term: string;
  year: number;
  supervisorName?: string;
  supervisorSignature?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  curriculum: 'lower' | 'advanced';
}

interface Class {
  id: string;
  name: string;
  curriculum: 'lower' | 'advanced';
}

interface Score {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  year: number;
  aoiMarks?: number; // Out of 20
  eotMarks?: number; // Out of 80
  marks: number;     // Total percentage (0-100)
  competency?: string;
  comment?: string;
}

interface TermComment {
  id: string;
  studentId: string;
  term: 'Term 1' | 'Term 2' | 'Term 3';
  year: number;
  teacherComment?: string;
  headteacherComment?: string;
  genericSkills?: string;
  values?: string;
}

interface SchoolSettings {
  id: string;
  breakingOffDate: string;
  reportingDate: string;
  term: string;
  year: number;
  headteacherComment?: string;
}

// --- Constants ---

const BUILT_IN_SUBJECTS = [
  // Lower Curriculum
  { name: 'English Language', code: '112', curriculum: 'lower' },
  { name: 'Mathematics', code: '456', curriculum: 'lower' },
  { name: 'Biology', code: '535', curriculum: 'lower' },
  { name: 'Chemistry', code: '545', curriculum: 'lower' },
  { name: 'Physics', code: '553', curriculum: 'lower' },
  { name: 'Geography', code: '273', curriculum: 'lower' },
  { name: 'History & Political Education', code: '241', curriculum: 'lower' },
  { name: 'Christian Religious Education', code: '223', curriculum: 'lower' },
  { name: 'Islamic Religious Education', code: '225', curriculum: 'lower' },
  { name: 'Entrepreneurship Education', code: '810', curriculum: 'lower' },
  { name: 'Agriculture', code: '527', curriculum: 'lower' },
  { name: 'Kiswahili', code: '335', curriculum: 'lower' },
  { name: 'Physical Education', code: '900', curriculum: 'lower' },
  { name: 'Performing Arts', code: '620', curriculum: 'lower' },
  { name: 'Art and Design', code: '610', curriculum: 'lower' },
  { name: 'Nutrition and Food Technology', code: '500', curriculum: 'lower' },
  { name: 'Technology and Design', code: '700', curriculum: 'lower' },
  { name: 'ICT', code: '840', curriculum: 'lower' },
  { name: 'Literature in English', code: '310', curriculum: 'lower' },
  { name: 'Commerce', code: '800', curriculum: 'lower' },
  { name: 'French', code: '336', curriculum: 'lower' },
  { name: 'Luganda', code: '331', curriculum: 'lower' },
  // Advanced Curriculum
  { name: 'General Paper', code: 'S101', curriculum: 'advanced' },
  { name: 'Sub-Maths', code: 'S475', curriculum: 'advanced' },
  { name: 'Subsidiary ICT', code: 'S850', curriculum: 'advanced' },
  { name: 'Mathematics', code: 'P425', curriculum: 'advanced' },
  { name: 'Physics', code: 'P510', curriculum: 'advanced' },
  { name: 'Chemistry', code: 'P525', curriculum: 'advanced' },
  { name: 'Biology', code: 'P530', curriculum: 'advanced' },
  { name: 'Economics', code: 'P210', curriculum: 'advanced' },
  { name: 'Geography', code: 'P250', curriculum: 'advanced' },
  { name: 'History', code: 'P110', curriculum: 'advanced' },
  { name: 'Literature in English', code: 'P240', curriculum: 'advanced' },
  { name: 'Divinity', code: 'P220', curriculum: 'advanced' },
  { name: 'Islamic Religious Education', code: 'P230', curriculum: 'advanced' },
  { name: 'Fine Art', code: 'P610', curriculum: 'advanced' },
  { name: 'Entrepreneurship Education', code: 'P810', curriculum: 'advanced' },
  { name: 'Agriculture', code: 'P527', curriculum: 'advanced' },
  { name: 'Music', code: 'P620', curriculum: 'advanced' },
  { name: 'Kiswahili', code: 'P335', curriculum: 'advanced' },
  { name: 'French', code: 'P336', curriculum: 'advanced' },
  { name: 'Luganda', code: 'P331', curriculum: 'advanced' },
];

const BUILT_IN_CLASSES = [
  { name: 'Senior 1', curriculum: 'lower' },
  { name: 'Senior 2', curriculum: 'lower' },
  { name: 'Senior 3', curriculum: 'lower' },
  { name: 'Senior 4', curriculum: 'lower' },
  { name: 'Senior 5', curriculum: 'advanced' },
  { name: 'Senior 6', curriculum: 'advanced' },
];

const GRADING_RANGES = {
  lower: [
    { range: '75 - 100', grade: '3', remark: 'Outstanding' },
    { range: '40 - 74', grade: '2', remark: 'Moderate' },
    { range: '0 - 39', grade: '1', remark: 'Basic' },
  ],
  upper: [
    { range: '80 - 100', grade: 'A', remark: 'Excellent' },
    { range: '70 - 79', grade: 'B', remark: 'Very Good' },
    { range: '60 - 69', grade: 'C', remark: 'Good' },
    { range: '50 - 59', grade: 'D', remark: 'Fair' },
    { range: '40 - 49', grade: 'E', remark: 'Pass' },
    { range: '35 - 39', grade: 'O', remark: 'Subsidiary' },
    { range: '0 - 34', grade: 'F', remark: 'Fail' },
  ]
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon }: any) => {
  const base = "flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    outline: "border border-gray-200 text-gray-600 hover:bg-gray-50"
  };
  
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`} disabled={disabled}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Input = ({ label, error, ...props }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input 
      className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 outline-none transition-all ${
        error 
          ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" 
          : "border-gray-200 focus:ring-blue-500/20 focus:border-blue-500"
      }`}
      {...props}
    />
    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select 
      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
      {...props}
    >
      <option value="">Select an option</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- Utilities ---

const resizeImage = (file: File | Blob, size: number = 400): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Center crop to square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', 0.7); // 0.7 quality for fast upload
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// --- Camera Capture Component ---

function CameraCapture({ onCapture, onClose, onDirectCapture, isUploading, uploadProgress }: { 
  onCapture: (blob: Blob) => void, 
  onClose: () => void, 
  onDirectCapture?: (blob: Blob) => void, 
  isUploading?: boolean,
  uploadProgress?: number
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: false 
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Could not access camera. Please check permissions.");
      }
    }
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capture = async (isDirect: boolean = false) => {
    if (videoRef.current && canvasRef.current && !isUploading) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 150);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Initial capture at video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              // Resize to passport format (400x400)
              const resized = await resizeImage(blob, 400);
              if (isDirect && onDirectCapture) {
                onDirectCapture(resized);
              } else {
                onCapture(resized);
              }
              // Don't close immediately if direct, wait for upload to start?
              // Actually handleDirectUpload is called, and it sets isUploading.
              // If it's direct, we might want to stay in camera until upload finishes or close immediately.
              // The current logic closes on capture.
              if (!isDirect) onClose();
            } catch (err) {
              console.error("Resize failed:", err);
              if (isDirect && onDirectCapture) {
                onDirectCapture(blob);
              } else {
                onCapture(blob);
              }
              if (!isDirect) onClose();
            }
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <p className="font-bold mb-2">Camera Error</p>
            <p className="text-sm text-gray-400">{error}</p>
            <Button onClick={onClose} variant="outline" className="mt-6 border-white/20 text-white hover:bg-white/10">Close</Button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            
            {/* Passport Frame Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-white/50 rounded-2xl relative">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-blue-500 rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-blue-500 rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-blue-500 rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-blue-500 rounded-br-sm" />
                
                {/* Face Guide */}
                <div className="absolute inset-x-8 top-12 bottom-12 border border-white/20 rounded-[50%] opacity-30" />
              </div>
              <p className="mt-4 text-xs font-bold text-white/70 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                Align Face Here
              </p>
            </div>

            {/* Flash Effect */}
            <AnimatePresence>
              {isFlashing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white z-10"
                />
              )}
            </AnimatePresence>

            {/* Uploading Overlay */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white p-6">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-bold text-lg">Uploading Photo...</p>
                <div className="w-full max-w-[200px] h-1.5 bg-white/20 rounded-full mt-4 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress || 0}%` }}
                    className="h-full bg-blue-500"
                  />
                </div>
                <p className="text-xs text-white/60 mt-2">{Math.round(uploadProgress || 0)}% Complete</p>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6 px-6">
              <button 
                onClick={onClose}
                disabled={isUploading}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all disabled:opacity-50"
                title="Cancel"
              >
                <X size={20} />
              </button>
              
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={() => capture(false)}
                  disabled={isUploading}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  title="Capture & Preview"
                >
                  <Camera size={28} />
                </button>
                <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Preview</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={() => capture(true)}
                  disabled={isUploading}
                  className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xl hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                  title="Direct Upload"
                >
                  <Zap size={28} />
                </button>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Direct</span>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mt-6 text-white/60 text-sm font-medium">Passport format: Square crop, 400x400px</p>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [termComments, setTermComments] = useState<TermComment[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch profile
        try {
          const profileDoc = await getDoc(doc(db, 'users', u.uid));
          if (profileDoc.exists()) {
            let p = profileDoc.data() as UserProfile;
            // Force admin role and active status for the primary admin email
            if (u.email === 'egaujerome4@gmail.com' && (p.role !== 'admin' || p.status !== 'active')) {
              p = { ...p, role: 'admin', status: 'active' };
              await updateDoc(doc(db, 'users', u.uid), { role: 'admin', status: 'active' });
            }
            setProfile(p);
          } else {
            let role: 'admin' | 'teacher' | 'student' = 'teacher';
            let status: 'active' | 'disabled' | 'pending' = 'pending';
            let name = u.displayName || 'New User';

            if (u.email === 'egaujerome4@gmail.com') {
              role = 'admin';
              status = 'active';
            }

            const newProfile: UserProfile = {
              uid: u.uid,
              name,
              email: u.email || '',
              role,
              status
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!user || !profile) return;

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'));

    const unsubScores = onSnapshot(collection(db, 'scores'), (snap) => {
      setScores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Score)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'scores'));

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      setTeachers(snap.docs.map(d => d.data() as UserProfile));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubTermComments = onSnapshot(collection(db, 'term_comments'), (snap) => {
      setTermComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as TermComment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'term_comments'));

    const unsubSettings = onSnapshot(collection(db, 'school_settings'), (snap) => {
      setSchoolSettings(snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolSettings)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'school_settings'));

    const unsubMedia = onSnapshot(collection(db, 'media'), (snap) => {
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'media'));

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => {
      unsubStudents();
      unsubClasses();
      unsubSubjects();
      unsubScores();
      unsubTeachers();
      unsubTermComments();
      unsubSettings();
      unsubMedia();
      unsubAttendance();
    };
  }, [user, profile]);

  // Built-in Data Auto-population
  useEffect(() => {
    if (loading || !profile || profile.role !== 'admin') return;

    const checkAndPopulate = async () => {
      // 1. Automatic Cleanup of existing duplicates and non-standard classes
      const standardClassNames = new Set(BUILT_IN_CLASSES.map(c => c.name.trim().toLowerCase()));
      
      // Cleanup Classes
      const classNamesSeen = new Set();
      const classesToDelete = [];
      const sortedClasses = [...classes].sort((a, b) => a.id.localeCompare(b.id));
      
      for (const cls of sortedClasses) {
        const normalized = cls.name.trim().toLowerCase();
        // Delete if it's a duplicate OR if it's not a standard class name
        if (classNamesSeen.has(normalized) || !standardClassNames.has(normalized)) {
          classesToDelete.push(cls);
        } else {
          classNamesSeen.add(normalized);
        }
      }
      
      if (classesToDelete.length > 0) {
        console.log(`Cleaning up ${classesToDelete.length} non-standard or duplicate classes...`);
        for (const dup of classesToDelete) await deleteDoc(doc(db, 'classes', dup.id));
      }

      // Cleanup Subjects
      const subjectCodesSeen = new Set();
      const duplicateSubjects = [];
      const sortedSubjects = [...subjects].sort((a, b) => a.id.localeCompare(b.id));
      for (const sub of sortedSubjects) {
        const normalized = sub.code.trim().toUpperCase();
        if (subjectCodesSeen.has(normalized)) duplicateSubjects.push(sub);
        else subjectCodesSeen.add(normalized);
      }
      if (duplicateSubjects.length > 0) {
        console.log(`Cleaning up ${duplicateSubjects.length} duplicate subjects...`);
        for (const dup of duplicateSubjects) await deleteDoc(doc(db, 'subjects', dup.id));
      }

      // 2. Check and Populate missing data
      // Check Subjects individually by code
      const existingSubjectCodes = new Set(subjects.map(s => s.code.trim().toUpperCase()));
      const subjectsToPopulate = BUILT_IN_SUBJECTS.filter(s => !existingSubjectCodes.has(s.code.trim().toUpperCase()));
      
      if (subjectsToPopulate.length > 0) {
        console.log(`Auto-populating ${subjectsToPopulate.length} missing subjects...`);
        for (const sub of subjectsToPopulate) {
          await addDoc(collection(db, 'subjects'), sub);
        }
      }

      // Check Classes individually by name
      const existingClassNames = new Set(classes.map(c => c.name.trim().toLowerCase()));
      const classesToPopulate = BUILT_IN_CLASSES.filter(c => !existingClassNames.has(c.name.trim().toLowerCase()));

      if (classesToPopulate.length > 0) {
        console.log(`Auto-populating ${classesToPopulate.length} missing classes...`);
        for (const cls of classesToPopulate) {
          await addDoc(collection(db, 'classes'), cls);
        }
      }
    };

    checkAndPopulate();
  }, [loading, profile, subjects.length, classes.length]);

  const login = async () => {
    if (!isConfigValid) {
      setLoginError("Firebase setup is incomplete. Please complete the setup using the tool in the sidebar or check your configuration.");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      setLoginError(error.message || "Login failed");
    }
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-500 font-medium">Loading School System...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <School size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Uganda School Management</h1>
            <p className="text-gray-500">Sign in to manage students, subjects, and generate report cards.</p>
          </div>

          {(!isConfigValid || loginError) && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-left space-y-2">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
                <AlertCircle size={14} />
                <span>Configuration Error</span>
              </div>
              <p className="text-xs text-red-600 leading-relaxed font-medium">
                {loginError || "Firebase configuration is not correctly set. Please complete the automated setup or provide valid API keys in firebase-applet-config.json."}
              </p>
            </div>
          )}

          <Button onClick={login} className="w-full py-3" icon={UserCircle}>
            Sign in with Google
          </Button>
          <p className="text-xs text-gray-400">
            Secure access for authorized school staff only.
          </p>
        </Card>
      </div>
    );
  }

  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Clock size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Approval Pending</h1>
            <p className="text-gray-500">Your account is awaiting approval from the administrator. You will be notified once your access is granted.</p>
          </div>
          <Button onClick={logout} className="w-full py-3" icon={LogOut}>
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  if (profile?.status === 'disabled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Account Disabled</h1>
            <p className="text-gray-500">Your account has been disabled by the administrator. Please contact the school office for assistance.</p>
          </div>
          <Button onClick={logout} className="w-full py-3" icon={LogOut}>
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-bottom border-gray-100">
          <div className="flex items-center gap-3 text-blue-600 font-bold text-xl">
            <School />
            <span>USMS</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {profile?.role !== 'student' && (
            <>
              <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Dashboard" />
              <NavItem active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon={ImageIcon} label="Photo Gallery" />
              <NavItem active={activeTab === 'media'} onClick={() => setActiveTab('media')} icon={FolderOpen} label="Media Library" />
              <NavItem active={activeTab === 'scores'} onClick={() => setActiveTab('scores')} icon={ClipboardCheck} label="Score Entry" />
              <NavItem active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={UserCheck} label="Attendance" />
              <NavItem active={activeTab === 'exam-cards'} onClick={() => setActiveTab('exam-cards')} icon={IdCard} label="Exam Cards" />
            </>
          )}
          {profile?.role === 'admin' && (
            <>
              <NavItem active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={Users} label="Students" />
              <NavItem active={activeTab === 'registration'} onClick={() => setActiveTab('registration')} icon={Zap} label="Subject Registration" />
              <NavItem active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} icon={GraduationCap} label="Classes" />
              <NavItem active={activeTab === 'subjects'} onClick={() => setActiveTab('subjects')} icon={BookOpen} label="Subjects" />
              <NavItem active={activeTab === 'teachers'} onClick={() => setActiveTab('teachers')} icon={UserCog} label="User Accounts" />
              <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="Settings" />
            </>
          )}
          <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FileText} label={profile?.role === 'student' ? "My Report Card" : "Report Cards"} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-2 rounded-lg mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {profile?.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{profile?.name}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                {profile?.teacherId && (
                  <>
                    <span className="text-gray-300">•</span>
                    <p className="text-[10px] text-blue-600 font-mono font-bold">{profile.teacherId}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button onClick={logout} variant="danger" className="w-full" icon={LogOut}>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 capitalize">{activeTab.replace('-', ' ')}</h2>
            <p className="text-gray-500">Manage your school's data efficiently.</p>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard stats={{ students, classes, subjects, scores, teachers, media }} />}
            {activeTab === 'gallery' && <StudentGallery students={students} classes={classes} />}
            {activeTab === 'media' && <MediaLibrary media={media} students={students} />}
            {activeTab === 'students' && <StudentsManager students={students} classes={classes} />}
            {activeTab === 'classes' && <ClassesManager classes={classes} />}
            {activeTab === 'subjects' && <SubjectsManager subjects={subjects} />}
            {activeTab === 'teachers' && <UserManager users={teachers} subjects={subjects} students={students} />}
            {activeTab === 'settings' && <SettingsManager schoolSettings={schoolSettings} />}
            {activeTab === 'scores' && <ScoreEntry scores={scores} students={students} subjects={subjects} classes={classes} profile={profile} />}
            {activeTab === 'registration' && <SubjectRegistration students={students} subjects={subjects} classes={classes} />}
            {activeTab === 'attendance' && <AttendanceManager students={students} classes={classes} subjects={subjects} attendance={attendance} profile={profile} schoolSettings={schoolSettings} />}
            {activeTab === 'exam-cards' && <ExamCardGenerator students={students} subjects={subjects} classes={classes} />}
            {activeTab === 'reports' && <ReportGenerator students={students} scores={scores} subjects={subjects} classes={classes} termComments={termComments} profile={profile} schoolSettings={schoolSettings} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
          ? "bg-blue-50 text-blue-600" 
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

// --- Dashboard View ---

function Dashboard({ stats }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard icon={Users} label="Total Students" value={stats.students.length} color="blue" />
        <StatCard icon={GraduationCap} label="Classes" value={stats.classes.length} color="green" />
        <StatCard icon={BookOpen} label="Subjects" value={stats.subjects.length} color="purple" />
        <StatCard icon={ClipboardCheck} label="Scores Recorded" value={stats.scores.length} color="orange" />
        <StatCard icon={ImageIcon} label="Media Files" value={stats.media.length} color="pink" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {stats.scores.slice(-5).reverse().map((score: any) => {
              const student = stats.students.find((s: any) => s.id === score.studentId);
              const subject = stats.subjects.find((s: any) => s.id === score.subjectId);
              return (
                <div key={score.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Score added for <span className="font-bold">{student?.name}</span> in <span className="font-bold">{subject?.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">{score.marks}% - {score.term}, {score.year}</p>
                  </div>
                </div>
              );
            })}
            {stats.scores.length === 0 && <p className="text-gray-500 text-sm italic">No recent activity found.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Curriculum Distribution</h3>
          <div className="space-y-6">
            <CurriculumProgress 
              label="Lower Curriculum (S1-S4)" 
              count={stats.students.filter((s: any) => s.curriculum === 'lower').length} 
              total={stats.students.length}
              color="bg-blue-500"
            />
            <CurriculumProgress 
              label="Advanced Curriculum (S5-S6)" 
              count={stats.students.filter((s: any) => s.curriculum === 'advanced').length} 
              total={stats.students.length}
              color="bg-purple-500"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    pink: "bg-pink-50 text-pink-600"
  };
  return (
    <Card className="p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}

function CurriculumProgress({ label, count, total, color }: any) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{count} Students ({Math.round(percentage)}%)</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// --- Student Gallery View ---

function StudentGallery({ students, classes }: any) {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  const filteredStudents = useMemo(() => {
    return students.filter((s: any) => {
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchesClass = selectedClass === 'all' || s.classId === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [students, search, selectedClass]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search students by name..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-gray-400" size={18} />
          <select
            className="flex-1 md:w-48 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="all">All Classes</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredStudents.map((student: any) => {
          const studentClass = classes.find((c: any) => c.id === student.classId);
          return (
            <motion.div
              layout
              key={student.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-100">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <User size={48} />
                    <span className="text-[10px] font-bold uppercase mt-2">No Photo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <p className="text-white text-[10px] font-bold truncate w-full">
                    {student.registrationNumber || 'No Reg #'}
                  </p>
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-gray-900 text-sm truncate" title={student.name}>
                  {student.name}
                </h3>
                <p className="text-xs text-blue-600 font-medium">
                  {studentClass?.name || 'Unknown Class'}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <ImageIcon className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 font-medium">No students found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}

// --- Students Manager ---

function StudentsManager({ students, classes }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<string | null>(null); // null for new student, id for existing
  const [pendingPhoto, setPendingPhoto] = useState<{ blob: Blob | File, previewUrl: string, studentId?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', classId: '', curriculum: 'lower', registrationNumber: '', photoUrl: '' });
  const [regError, setRegError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);

  const exportToCSV = () => {
    // Collect all students (assigned and unassigned)
    const allStudents = [...students].filter(student => 
      !searchQuery || 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.registrationNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (allStudents.length === 0) {
      setStatusMessage({ type: 'error', text: 'No students found to export.' });
      return;
    }

    const headers = ['Name', 'Registration Number', 'Class', 'Curriculum'];
    const rows = allStudents.map(s => {
      const className = s.classId === 'unassigned' ? 'Unassigned' : classes.find((c: any) => c.id === s.classId)?.name || 'N/A';
      return [
        `"${s.name.replace(/"/g, '""')}"`,
        `"${(s.registrationNumber || 'N/A').replace(/"/g, '""')}"`,
        `"${className.replace(/"/g, '""')}"`,
        `"${s.curriculum.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Students_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ type: 'success', text: `Exported ${allStudents.length} students to CSV.` });
  };

  const generateRegNumber = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 7; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, registrationNumber: `UG-${result}` }));
    setRegError('');
  };

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const validateRegNumber = (val: string) => {
    if (!val) return '';
    const regex = /^UG-[A-Z0-9]{7}$/;
    if (!regex.test(val)) {
      return "Format must be 'UG-' followed by 7 alphanumeric characters (Total 10)";
    }
    return '';
  };

  const groupedStudents = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    // Initialize groups for all classes
    classes.forEach((cls: any) => {
      groups[cls.id] = [];
    });
    
    // Add "Unassigned" group if needed
    groups['unassigned'] = [];

    students.forEach((student: any) => {
      const filtered = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (student.registrationNumber && student.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (filtered) {
        if (groups[student.classId]) {
          groups[student.classId].push(student);
        } else {
          groups['unassigned'].push(student);
        }
      }
    });

    return groups;
  }, [students, classes, searchQuery]);

  const handleUpdateClass = async (studentId: string, newClassId: string) => {
    try {
      await updateDoc(doc(db, 'students', studentId), { classId: newClassId });
      setStatusMessage({ type: 'success', text: 'Student class updated!' });
      setEditingStudentId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | Blob, studentId?: string) => {
    let file: File | Blob;
    if (e instanceof Blob) {
      file = e;
    } else {
      const f = e.target.files?.[0];
      if (!f) return;
      file = f;
    }

    try {
      // Automatically resize to passport format (400x400) for fast upload
      const resized = await resizeImage(file, 400);
      const previewUrl = URL.createObjectURL(resized);
      setPendingPhoto({ blob: resized, previewUrl, studentId });
    } catch (err) {
      console.error("Resize failed:", err);
      const previewUrl = URL.createObjectURL(file);
      setPendingPhoto({ blob: file, previewUrl, studentId });
    }
  };

  const handleDirectUpload = async (blob: Blob, studentId?: string) => {
    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage({ type: 'info', text: 'Optimizing photo...' });
    
    try {
      // Ensure it is resized to passport format before uploading
      const optimizedBlob = await resizeImage(blob, 400);
      
      const storageRef = ref(storage, `students/${studentId || 'new'}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, optimizedBlob);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error("Upload failed", error);
          setStatusMessage({ type: 'error', text: `Upload failed: ${error.message}` });
          setIsUploading(false);
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Record in media database
          try {
            await addDoc(collection(db, 'media'), {
              url,
              type: 'photo',
              uploadedAt: serverTimestamp(),
              uploadedBy: auth.currentUser?.uid || 'anonymous',
              studentId: studentId || null
            });
          } catch (err) {
            console.error("Failed to record media:", err);
          }

          if (studentId) {
            await updateDoc(doc(db, 'students', studentId), { photoUrl: url });
            setStatusMessage({ type: 'success', text: 'Photo updated successfully!' });
          } else {
            setFormData(prev => ({ ...prev, photoUrl: url }));
            setStatusMessage({ type: 'success', text: 'Photo uploaded and ready!' });
          }
          setIsCapturing(false);
          setCaptureTarget(null);
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (error: any) {
      console.error("Upload setup failed", error);
      setStatusMessage({ type: 'error', text: `Setup failed: ${error.message}` });
      setIsUploading(false);
    }
  };

  const performUpload = async () => {
    if (!pendingPhoto) return;

    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage({ type: 'info', text: 'Starting upload...' });

    try {
      const storageRef = ref(storage, `students/${pendingPhoto.studentId || 'new'}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, pendingPhoto.blob);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error("Upload failed", error);
          setStatusMessage({ type: 'error', text: `Upload failed: ${error.message}` });
          setIsUploading(false);
        }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);

          // Record in media database
          try {
            await addDoc(collection(db, 'media'), {
              url,
              type: 'photo',
              uploadedAt: serverTimestamp(),
              uploadedBy: auth.currentUser?.uid || 'anonymous',
              studentId: pendingPhoto.studentId || null
            });
          } catch (err) {
            console.error("Failed to record media:", err);
          }

          if (pendingPhoto.studentId) {
            await updateDoc(doc(db, 'students', pendingPhoto.studentId), { photoUrl: url });
            setStatusMessage({ type: 'success', text: 'Photo updated successfully!' });
          } else {
            setFormData(prev => ({ ...prev, photoUrl: url }));
            setStatusMessage({ type: 'success', text: 'Photo uploaded and ready!' });
          }
          setPendingPhoto(null);
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (error: any) {
      console.error("Upload setup failed", error);
      setStatusMessage({ type: 'error', text: `Setup failed: ${error.message}` });
      setIsUploading(false);
    }
  };

  const handleAdd = async (e: any) => {
    e.preventDefault();
    
    const error = validateRegNumber(formData.registrationNumber);
    if (error) {
      setRegError(error);
      return;
    }

    try {
      await addDoc(collection(db, 'students'), formData);
      setIsAdding(false);
      setFormData({ name: '', classId: '', curriculum: 'lower', registrationNumber: '', photoUrl: '' });
      setRegError('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const handleDelete = (student: any) => {
    setStudentToDelete(student);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteDoc(doc(db, 'students', studentToDelete.id));
      setStudentToDelete(null);
      setStatusMessage({ type: 'success', text: `Student ${studentToDelete.name} deleted successfully.` });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentToDelete.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {isCapturing && (
        <CameraCapture 
          onCapture={(blob) => handleFileUpload(blob, captureTarget || undefined)} 
          onDirectCapture={(blob) => handleDirectUpload(blob, captureTarget || undefined)}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onClose={() => {
            setIsCapturing(false);
            setCaptureTarget(null);
          }} 
        />
      )}

      {statusMessage && (
        <div className="fixed top-24 right-8 z-[100] animate-in fade-in slide-in-from-right-4">
          <Card className={`p-4 flex items-center gap-3 shadow-2xl border-l-4 ${
            statusMessage.type === 'success' ? 'border-green-500 bg-green-50' :
            statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
            'border-blue-500 bg-blue-50'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="text-green-600" size={20} /> :
             statusMessage.type === 'error' ? <AlertCircle className="text-red-600" size={20} /> :
             <Loader2 className="text-blue-600 animate-spin" size={20} />}
            <p className={`text-sm font-bold ${
              statusMessage.type === 'success' ? 'text-green-800' :
              statusMessage.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {statusMessage.text}
            </p>
          </Card>
        </div>
      )}

      {pendingPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-6">
            <div className="text-center">
              <h4 className="text-xl font-bold text-gray-900">Confirm Photo</h4>
              <p className="text-sm text-gray-500">Does this photo look correct?</p>
            </div>
            
            <div className="aspect-square w-full max-w-[240px] mx-auto rounded-2xl overflow-hidden border-4 border-white shadow-xl">
              <img src={pendingPhoto.previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => {
                  URL.revokeObjectURL(pendingPhoto.previewUrl);
                  setPendingPhoto(null);
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={performUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-1 w-full">
                    <div className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      <span className="text-xs">Uploading {Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  'Confirm & Upload'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {studentToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border-2 border-red-100"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-2">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Delete Student?</h3>
              <p className="text-gray-500 font-medium leading-relaxed">
                You are about to permanently remove <span className="text-red-600 font-black">"{studentToDelete.name}"</span> from the school database. This action cannot be undone.
              </p>
              
              <div className="flex flex-col w-full gap-3 pt-4">
                <Button 
                  variant="danger" 
                  className="w-full py-4 text-lg font-black uppercase tracking-widest shadow-lg shadow-red-100"
                  onClick={confirmDelete}
                >
                  Confirm Deletion
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full py-4 text-lg font-black uppercase tracking-widest border-2"
                  onClick={() => setStudentToDelete(null)}
                >
                  Keep Student
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-xl font-bold">Manage Students</h3>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search students..." 
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full sm:w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} icon={FileDown}>Export CSV</Button>
            <Button onClick={() => setIsAdding(true)} icon={Plus}>Add Student</Button>
          </div>
        </div>
      </div>

      {isAdding && (
        <Card className="p-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input label="Student Name" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} required />
              <Select 
                label="Class" 
                value={formData.classId} 
                onChange={(e: any) => setFormData({ ...formData, classId: e.target.value })} 
                options={classes.map((c: any) => ({ label: c.name, value: c.id }))}
                required 
              />
              <Select 
                label="Curriculum" 
                value={formData.curriculum} 
                onChange={(e: any) => setFormData({ ...formData, curriculum: e.target.value })} 
                options={[{ label: 'Lower (S1-S4)', value: 'lower' }, { label: 'Advanced (S5-S6)', value: 'advanced' }]}
                required 
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input 
                    label="Registration Number" 
                    value={formData.registrationNumber} 
                    error={regError}
                    onChange={(e: any) => {
                      const val = e.target.value.toUpperCase();
                      setFormData({ ...formData, registrationNumber: val });
                      setRegError(validateRegNumber(val));
                    }} 
                    placeholder="e.g. UG-ABC1234"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={generateRegNumber} 
                  icon={RefreshCw}
                  className="mb-1"
                >
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-bold text-gray-700">Student Photo</p>
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors relative group">
                {formData.photoUrl ? (
                  <div className="relative w-32 h-32">
                    <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover rounded-xl shadow-md" />
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, photoUrl: '' })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                    <div className="text-center">
                      <div className="flex gap-2 justify-center mb-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <Upload className="text-gray-400" size={20} />
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setIsCapturing(true);
                            setCaptureTarget(null);
                          }}
                          className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md hover:bg-blue-700 transition-all"
                        >
                          <Camera size={20} />
                        </button>
                      </div>
                      <p className="text-sm font-medium text-gray-600">Upload or Take Photo</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 5MB</p>
                    </div>
                )}
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept="image/*" 
                  onChange={(e) => handleFileUpload(e)} 
                  disabled={isUploading} 
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                  </div>
                )}
              </div>
              <Input 
                label="Or paste Photo URL" 
                value={formData.photoUrl} 
                onChange={(e: any) => setFormData({ ...formData, photoUrl: e.target.value })} 
                placeholder="https://..." 
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Save Student'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-8">
        {[...classes].sort((a, b) => a.name.localeCompare(b.name)).map((cls: any) => {
          const classStudents = groupedStudents[cls.id] || [];
          if (classStudents.length === 0 && searchQuery) return null;

          return (
            <div key={cls.id} className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                <h4 className="text-lg font-bold text-gray-900">{cls.name}</h4>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
                  {classStudents.length} Students
                </span>
              </div>
              
              <Card>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-sm font-bold text-gray-700">Student</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700">Registration Number</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700">Curriculum</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {classStudents.length > 0 ? (
                      classStudents.map((student: any) => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative group">
                                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                  {student.photoUrl ? (
                                    <img src={student.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                                      {student.name ? student.name.charAt(0) : '??'}
                                    </div>
                                  )}
                                </div>
                                <label className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsCapturing(true);
                                      setCaptureTarget(student.id);
                                    }}
                                    className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 text-white"
                                  >
                                    <Camera size={14} />
                                  </button>
                                  <div className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 text-white relative">
                                    <Upload size={14} />
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleFileUpload(e, student.id)} />
                                  </div>
                                </label>
                              </div>
                              <span className="text-sm font-bold text-gray-900">{student.name}</span>
                              {editingStudentId === student.id ? (
                                <select 
                                  className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                                  value={student.classId}
                                  onChange={(e) => handleUpdateClass(student.id, e.target.value)}
                                  autoFocus
                                  onBlur={() => setEditingStudentId(null)}
                                >
                                  {classes.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                  <option value="unassigned">Unassigned</option>
                                </select>
                              ) : (
                                <button 
                                  onClick={() => setEditingStudentId(student.id)}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Change Class"
                                >
                                  <Edit size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono font-medium text-blue-700">{student.registrationNumber || 'No Reg. No.'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 capitalize">{student.curriculum}</td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="danger" onClick={() => handleDelete(student)} icon={Trash2} className="ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">
                          No students in this class
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          );
        })}

        {groupedStudents['unassigned']?.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <h4 className="text-lg font-bold text-gray-900">Unassigned Students</h4>
              <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                {groupedStudents['unassigned'].length} Students
              </span>
            </div>
            
            <Card>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-sm font-bold text-gray-700">Student</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-700">Registration Number</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-700">Curriculum</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedStudents['unassigned'].map((student: any) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative group">
                            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                              {student.photoUrl ? (
                                <img src={student.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                                  {student.name ? student.name.charAt(0) : '??'}
                                </div>
                              )}
                            </div>
                            <label className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 cursor-pointer transition-opacity">
                              <button 
                                type="button"
                                onClick={() => {
                                  setIsCapturing(true);
                                  setCaptureTarget(student.id);
                                }}
                                className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 text-white"
                              >
                                <Camera size={14} />
                              </button>
                              <div className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 text-white relative">
                                <Upload size={14} />
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleFileUpload(e, student.id)} />
                              </div>
                            </label>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{student.name}</span>
                          {editingStudentId === student.id ? (
                            <select 
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                              value="unassigned"
                              onChange={(e) => handleUpdateClass(student.id, e.target.value)}
                              autoFocus
                              onBlur={() => setEditingStudentId(null)}
                            >
                              <option value="unassigned">Unassigned</option>
                              {classes.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          ) : (
                            <button 
                              onClick={() => setEditingStudentId(student.id)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Assign Class"
                            >
                              <Edit size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-medium text-blue-700">{student.registrationNumber || 'No Reg. No.'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 capitalize">{student.curriculum}</td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="danger" onClick={() => handleDelete(student)} icon={Trash2} className="ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Classes Manager ---

function ClassesManager({ classes }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', curriculum: 'lower' });
  const [activeCurriculum, setActiveCurriculum] = useState<'lower' | 'advanced'>('lower');

  const handleAdd = async (e: any) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'classes'), formData);
      setIsAdding(false);
      setFormData({ name: '', curriculum: activeCurriculum });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    }
  };

  const handleCleanup = async () => {
    if (!confirm("This will find and remove duplicate classes (case-insensitive, trimmed). Continue?")) return;
    
    const seen = new Set();
    const duplicates = [];
    
    // Sort by ID to keep the oldest one (usually)
    const sortedClasses = [...classes].sort((a, b) => a.id.localeCompare(b.id));
    
    for (const cls of sortedClasses) {
      const normalizedName = cls.name.trim().toLowerCase();
      if (seen.has(normalizedName)) {
        duplicates.push(cls);
      } else {
        seen.add(normalizedName);
      }
    }
    
    if (duplicates.length === 0) {
      alert("No duplicate classes found.");
      return;
    }
    
    try {
      for (const dup of duplicates) {
        await deleteDoc(doc(db, 'classes', dup.id));
      }
      alert(`Successfully removed ${duplicates.length} duplicate classes.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'classes');
    }
  };

  const handleReset = async () => {
    if (!confirm("WARNING: This will delete ALL current classes and restore the standard Senior 1-6 list. Students linked to deleted classes may lose their class reference. Continue?")) return;
    
    try {
      // Delete all
      for (const cls of classes) {
        await deleteDoc(doc(db, 'classes', cls.id));
      }
      // Add defaults
      for (const cls of BUILT_IN_CLASSES) {
        await addDoc(collection(db, 'classes'), cls);
      }
      alert("Classes have been reset to defaults.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'classes');
    }
  };

  const filteredClasses = classes.filter((c: any) => c.curriculum === activeCurriculum);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold">Manage Classes</h3>
          <p className="text-sm text-gray-500">Define the classes in your school</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleReset} icon={Trash2} className="text-orange-600 border-orange-200 hover:bg-orange-50">Reset to Defaults</Button>
          <Button variant="secondary" onClick={handleCleanup} icon={Trash2}>Cleanup Duplicates</Button>
          <Button onClick={() => setIsAdding(true)} icon={Plus}>Add New Class</Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveCurriculum('lower')}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
            activeCurriculum === 'lower' 
              ? "border-blue-600 text-blue-600 bg-blue-50/50" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Lower Curriculum (S1-S4)
        </button>
        <button 
          onClick={() => setActiveCurriculum('advanced')}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
            activeCurriculum === 'advanced' 
              ? "border-blue-600 text-blue-600 bg-blue-50/50" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Advanced Curriculum (S5-S6)
        </button>
      </div>

      {isAdding && (
        <Card className="p-6 border-blue-100 bg-blue-50/30">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Class Name (e.g., Senior 1)" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} required />
            <Select 
              label="Curriculum" 
              value={formData.curriculum} 
              onChange={(e: any) => setFormData({ ...formData, curriculum: e.target.value })} 
              options={[{ label: 'Lower', value: 'lower' }, { label: 'Advanced', value: 'advanced' }]}
              required 
            />
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit">Save Class</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredClasses.map((cls: any) => (
          <Card key={cls.id} className="p-6 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <h4 className="text-lg font-bold text-gray-900">{cls.name}</h4>
            <p className="text-sm text-gray-500 capitalize mb-4">{cls.curriculum} Curriculum</p>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Active</span>
              <Button variant="danger" onClick={async () => {
                if(confirm(`Delete ${cls.name}?`)) await deleteDoc(doc(db, 'classes', cls.id));
              }} icon={Trash2} />
            </div>
          </Card>
        ))}
        {filteredClasses.length === 0 && (
          <div className="md:col-span-3 py-12 text-center text-gray-400 italic text-sm">
            No classes found for this curriculum.
          </div>
        )}
      </div>
    </div>
  );
}

// --- Subjects Manager ---

function SubjectsManager({ subjects }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', curriculum: 'lower' });
  const [activeCurriculum, setActiveCurriculum] = useState<'lower' | 'advanced'>('lower');

  const handleAdd = async (e: any) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'subjects'), formData);
      setIsAdding(false);
      setFormData({ name: '', code: '', curriculum: activeCurriculum });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'subjects');
    }
  };

  const handleCleanup = async () => {
    if (!confirm("This will find and remove duplicate subjects (case-insensitive code). Continue?")) return;
    
    const seen = new Set();
    const duplicates = [];
    
    // Sort by ID to keep the oldest one
    const sortedSubjects = [...subjects].sort((a, b) => a.id.localeCompare(b.id));
    
    for (const sub of sortedSubjects) {
      const normalizedCode = sub.code.trim().toUpperCase();
      if (seen.has(normalizedCode)) {
        duplicates.push(sub);
      } else {
        seen.add(normalizedCode);
      }
    }
    
    if (duplicates.length === 0) {
      alert("No duplicate subjects found.");
      return;
    }
    
    try {
      for (const dup of duplicates) {
        await deleteDoc(doc(db, 'subjects', dup.id));
      }
      alert(`Successfully removed ${duplicates.length} duplicate subjects.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'subjects');
    }
  };

  const handleReset = async () => {
    if (!confirm("WARNING: This will delete ALL current subjects and restore the standard UNEB list. Scores linked to deleted subjects may be lost. Continue?")) return;
    
    try {
      // Delete all
      for (const sub of subjects) {
        await deleteDoc(doc(db, 'subjects', sub.id));
      }
      // Add defaults
      for (const sub of BUILT_IN_SUBJECTS) {
        await addDoc(collection(db, 'subjects'), sub);
      }
      alert("Subjects have been reset to defaults.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'subjects');
    }
  };

  const filteredSubjects = subjects.filter((s: any) => s.curriculum === activeCurriculum);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold">Manage Subjects</h3>
          <p className="text-sm text-gray-500">Configure subjects for both curricula</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleReset} icon={Trash2} className="text-orange-600 border-orange-200 hover:bg-orange-50">Reset to Defaults</Button>
          <Button variant="secondary" onClick={handleCleanup} icon={Trash2}>Cleanup Duplicates</Button>
          <Button onClick={() => setIsAdding(true)} icon={Plus}>Add New Subject</Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveCurriculum('lower')}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
            activeCurriculum === 'lower' 
              ? "border-blue-600 text-blue-600 bg-blue-50/50" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Lower Curriculum (S1-S4)
        </button>
        <button 
          onClick={() => setActiveCurriculum('advanced')}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
            activeCurriculum === 'advanced' 
              ? "border-blue-600 text-blue-600 bg-blue-50/50" 
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          Advanced Curriculum (S5-S6)
        </button>
      </div>

      {isAdding && (
        <Card className="p-6 border-blue-100 bg-blue-50/30">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Subject Name" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} required />
            <Input label="Subject Code" value={formData.code} onChange={(e: any) => setFormData({ ...formData, code: e.target.value })} required />
            <Select 
              label="Curriculum" 
              value={formData.curriculum} 
              onChange={(e: any) => setFormData({ ...formData, curriculum: e.target.value })} 
              options={[{ label: 'Lower', value: 'lower' }, { label: 'Advanced', value: 'advanced' }]}
              required 
            />
            <div className="md:col-span-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit">Save Subject</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Subject Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSubjects.map((sub: any) => (
              <tr key={sub.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold font-mono">
                    {sub.code}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{sub.name}</td>
                <td className="px-6 py-4 text-right">
                  <Button 
                    variant="danger" 
                    onClick={async () => {
                      if(confirm(`Delete ${sub.name}?`)) await deleteDoc(doc(db, 'subjects', sub.id));
                    }} 
                    icon={Trash2} 
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" 
                  />
                </td>
              </tr>
            ))}
            {filteredSubjects.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                  No subjects found for this curriculum.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// --- User Manager ---

function UserManager({ users, subjects, students, classes }: any) {
  const [editingUser, setEditingUser] = useState<any>(null);
  const [tempSubjects, setTempSubjects] = useState<string[]>([]);
  const [tempStudentId, setTempStudentId] = useState<string>('');
  const [tempTeacherId, setTempTeacherId] = useState<string>('');
  const [tempRole, setTempRole] = useState<string>('');
  const [tempStatus, setTempStatus] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const generateTeacherId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    setTempTeacherId(`TCH-${year}-${random}`);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.teacherId && u.teacherId.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [users, searchQuery]);

  const handleStartEdit = (user: any) => {
    setEditingUser(user);
    setTempSubjects(user.subjects || []);
    setTempStudentId(user.studentId || '');
    setTempTeacherId(user.teacherId || '');
    setTempRole(user.role || 'teacher');
    setTempStatus(user.status || 'pending');
  };

  const toggleTempSubject = (subjectId: string) => {
    setTempSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId) 
        : [...prev, subjectId]
    );
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const updates: any = { 
        role: tempRole,
        status: tempStatus
      };
      
      if (tempRole === 'teacher') {
        updates.subjects = tempSubjects;
        updates.teacherId = tempTeacherId;
        updates.studentId = null;
      } else if (tempRole === 'student') {
        updates.studentId = tempStudentId;
        updates.subjects = [];
        updates.teacherId = null;
      } else {
        updates.subjects = [];
        updates.studentId = null;
        updates.teacherId = null;
      }

      await updateDoc(doc(db, 'users', editingUser.uid), updates);
      setEditingUser(null);
      setShowConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${editingUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-bold">Manage User Accounts & Roles</h3>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search users or IDs..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-sm font-bold text-gray-700">User Name</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700">Email</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700">Status</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700">Role / Assignment</th>
              <th className="px-6 py-4 text-sm font-bold text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user: any) => (
              <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-gray-900">{user.name}</p>
                  {user.teacherId && (
                    <p className="text-[10px] text-blue-600 font-mono mt-0.5">ID: {user.teacherId}</p>
                  )}
                  <div className="flex gap-1 mt-1">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                      user.role === 'teacher' ? 'bg-blue-100 text-blue-600' :
                      'bg-green-100 text-green-600'
                    }`}>{user.role}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                    user.status === 'active' ? 'bg-green-100 text-green-600' :
                    user.status === 'disabled' ? 'bg-red-100 text-red-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {user.status || 'pending'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.role === 'teacher' && (
                    <div className="flex flex-wrap gap-1">
                      {(user.subjects || []).map((sId: string) => {
                        const sub = subjects.find((s: any) => s.id === sId);
                        return (
                          <span key={sId} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                            {sub?.code || sId}
                          </span>
                        );
                      })}
                      {(user.subjects || []).length === 0 && <span className="text-xs text-gray-400 italic">No subjects assigned</span>}
                    </div>
                  )}
                  {user.role === 'student' && (
                    <div className="flex items-center gap-2">
                      <GraduationCap size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-600">
                        {students.find((s: any) => s.id === user.studentId)?.name || 'Not linked to student record'}
                      </span>
                    </div>
                  )}
                  {user.role === 'admin' && <span className="text-xs text-gray-400 italic">Full Access</span>}
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <Button 
                    variant={user.status === 'active' ? 'outline' : 'success'} 
                    onClick={async () => {
                      try {
                        const newStatus = user.status === 'active' ? 'disabled' : 'active';
                        await updateDoc(doc(db, 'users', user.uid), { status: newStatus });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
                      }
                    }} 
                    icon={user.status === 'active' ? UserX : UserCheck} 
                    size="sm"
                  >
                    {user.status === 'active' ? 'Disable' : (user.status === 'pending' ? 'Approve' : 'Enable')}
                  </Button>
                  <Button variant="outline" onClick={() => handleStartEdit(user)} icon={UserCog} size="sm">Edit Role</Button>
                  <Button 
                    variant="danger" 
                    onClick={async () => {
                      if(confirm(`Remove ${user.name} from the system?`)) {
                        try {
                          await deleteDoc(doc(db, 'users', user.uid));
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
                        }
                      }
                    }} 
                    icon={Trash2} 
                    size="sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full p-6 space-y-6 relative">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Edit User: {editingUser.name}</h3>
              <Button variant="outline" onClick={() => setEditingUser(null)} icon={X} />
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select 
                  label="Account Role" 
                  value={tempRole} 
                  onChange={(e: any) => setTempRole(e.target.value)}
                  options={[
                    { label: 'Administrator', value: 'admin' },
                    { label: 'Teacher', value: 'teacher' },
                    { label: 'Student', value: 'student' }
                  ]}
                />
                <Select 
                  label="Account Status" 
                  value={tempStatus} 
                  onChange={(e: any) => setTempStatus(e.target.value)}
                  options={[
                    { label: 'Active', value: 'active' },
                    { label: 'Disabled', value: 'disabled' },
                    { label: 'Pending', value: 'pending' }
                  ]}
                />
              </div>

              {tempRole === 'teacher' && (
                <div className="space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input 
                        label="Teacher ID / Unique Number" 
                        value={tempTeacherId} 
                        onChange={(e: any) => setTempTeacherId(e.target.value)} 
                        placeholder="e.g. TCH-2024-001"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={generateTeacherId} 
                      icon={RefreshCw}
                      className="mb-1"
                    >
                      Generate
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">Assign Subjects</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto p-1">
                      {subjects.map((sub: any) => {
                        const isAssigned = tempSubjects.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleTempSubject(sub.id)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isAssigned 
                                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" 
                                : "border-gray-100 hover:border-gray-200 text-gray-600"
                            }`}
                          >
                            <p className="text-xs font-bold uppercase opacity-50">{sub.code}</p>
                            <p className="text-sm font-bold truncate">{sub.name}</p>
                            <p className="text-[10px] capitalize">{sub.curriculum}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {tempRole === 'student' && (
                <Select 
                  label="Link to Student Record" 
                  value={tempStudentId} 
                  onChange={(e: any) => setTempStudentId(e.target.value)}
                  options={[
                    { label: '-- Select Student --', value: '' },
                    ...students.map((s: any) => ({ label: `${s.name} (${classes.find((c: any) => c.id === s.classId)?.name || 'No Class'})`, value: s.id }))
                  ]}
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={() => setShowConfirm(true)} icon={Save}>Save Changes</Button>
            </div>

            {/* Confirmation Overlay */}
            <AnimatePresence>
              {showConfirm && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/95 flex items-center justify-center p-6 z-[60] rounded-xl"
                >
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Confirm Changes</h4>
                      <p className="text-sm text-gray-500">
                        You are about to update the role and assignments for {editingUser.name}. Are you sure?
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => setShowConfirm(false)}>Back</Button>
                      <Button onClick={handleSave} disabled={isSaving} icon={isSaving ? Loader2 : Check}>
                        {isSaving ? 'Saving...' : 'Confirm & Save'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      )}
    </div>
  );
}

function MediaLibrary({ media, students }: any) {
  const [search, setSearch] = useState('');

  const filteredMedia = useMemo(() => {
    return [...media].sort((a, b) => {
      const dateA = a.uploadedAt?.toDate?.() || new Date(a.uploadedAt);
      const dateB = b.uploadedAt?.toDate?.() || new Date(b.uploadedAt);
      return dateB - dateA;
    }).filter((m: any) => {
      if (!search) return true;
      const student = students.find((s: any) => s.id === m.studentId);
      return student?.name.toLowerCase().includes(search.toLowerCase()) || 
             m.type.toLowerCase().includes(search.toLowerCase());
    });
  }, [media, search, students]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by student name or type..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-500 font-medium">
          Total Items: {media.length}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredMedia.map((m: any) => {
          const student = students.find((s: any) => s.id === m.studentId);
          const date = m.uploadedAt?.toDate?.() || new Date(m.uploadedAt);
          
          return (
            <Card key={m.id} className="group overflow-hidden hover:shadow-md transition-all">
              <div className="aspect-square relative bg-gray-100 overflow-hidden">
                <img 
                  src={m.url} 
                  alt="Media" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a 
                    href={m.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-white rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    className="rounded-full w-8 h-8 p-0 flex items-center justify-center"
                    onClick={async () => {
                      if(confirm("Delete this media record? (File in storage will remain)")) {
                        await deleteDoc(doc(db, 'media', m.id));
                      }
                    }}
                    icon={Trash2}
                  />
                </div>
              </div>
              <div className="p-2 space-y-1">
                <p className="text-[10px] font-bold text-gray-900 truncate">
                  {student?.name || 'Unlinked'}
                </p>
                <p className="text-[8px] text-gray-500">
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredMedia.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <ImageIcon className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 font-medium">No media found.</p>
        </div>
      )}
    </div>
  );
}

function ScoreRow({ student, subjectId, term, year, assessmentType, existingScore, onUpdate }: any) {
  const [aoi, setAoi] = useState(existingScore?.aoiMarks || 0);
  const [eot, setEot] = useState(existingScore?.eotMarks || 0);
  const [comment, setComment] = useState(existingScore?.comment || '');
  const [studentName, setStudentName] = useState(student.name);

  useEffect(() => {
    setAoi(existingScore?.aoiMarks || 0);
    setEot(existingScore?.eotMarks || 0);
    setComment(existingScore?.comment || '');
  }, [existingScore]);

  useEffect(() => {
    setStudentName(student.name);
  }, [student.name]);

  const total = aoi + eot;
  const grade = getGrade(total, student.curriculum);
  
  const isNearPass = total >= 35 && total < 40;
  const isNearCredit = total >= 70 && total < 75;
  const isExceptional = total >= 90;

  const handleBlur = () => {
    if (aoi !== existingScore?.aoiMarks || eot !== existingScore?.eotMarks || comment !== existingScore?.comment) {
      onUpdate(student.id, subjectId, { aoiMarks: aoi, eotMarks: eot, comment });
    }
  };

  const handleNameBlur = async () => {
    if (studentName !== student.name && studentName.trim()) {
      try {
        await updateDoc(doc(db, 'students', student.id), { name: studentName.trim() });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `students/${student.id}`);
      }
    }
  };

  return (
    <tr className="group border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            className="flex-1 bg-transparent border-none focus:ring-2 focus:ring-blue-500/20 rounded px-2 py-1 font-bold text-gray-900 outline-none transition-colors"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            onBlur={handleNameBlur}
          />
          {isExceptional && (
            <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-yellow-500"
            >
              <Award size={16} fill="currentColor" />
            </motion.div>
          )}
        </div>
      </td>
      {(assessmentType === 'aoi' || assessmentType === 'both') && (
        <td className="px-6 py-4 text-center">
          <input 
            type="number" 
            min="0" 
            max="20"
            className="w-16 px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-mono"
            value={aoi || ''}
            onChange={(e) => setAoi(Number(e.target.value))}
            onBlur={handleBlur}
          />
          <p className="text-[10px] text-gray-400 mt-1">Con: {(aoi / 20 * 3).toFixed(1)}</p>
        </td>
      )}
      {(assessmentType === 'eot' || assessmentType === 'both') && (
        <td className="px-6 py-4 text-center">
          <input 
            type="number" 
            min="0" 
            max="80"
            className="w-16 px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-mono"
            value={eot || ''}
            onChange={(e) => setEot(Number(e.target.value))}
            onBlur={handleBlur}
          />
          <p className="text-[10px] text-gray-400 mt-1">Con: {(eot / 80 * 3).toFixed(1)}</p>
        </td>
      )}
      <td className="px-6 py-4 text-center">
        <div className="relative inline-flex flex-col items-center">
          <span className={`text-lg font-black tracking-tighter ${
            total > 100 ? 'text-red-500' : 
            isExceptional ? 'text-blue-700' : 'text-gray-900'
          }`}>
            {total}%
          </span>
          {(isNearPass || isNearCredit) && (
            <motion.span 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`absolute -top-1 -right-6 text-[8px] px-1 rounded font-black uppercase tracking-tighter ${isNearPass ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}
            >
              Border
            </motion.span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
          total >= 75 ? 'bg-green-100 text-green-700 ring-1 ring-green-200' :
          total >= 40 ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' :
          'bg-red-100 text-red-700 ring-1 ring-red-200'
        }`}>
          {total >= 75 ? <TrendingUp size={10} /> : null}
          {grade}
        </span>
      </td>
      <td className="px-6 py-4">
        <input 
          type="text" 
          placeholder="Observation..."
          className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="px-6 py-4 text-right">
        {existingScore && (
          <Button 
            variant="danger" 
            size="sm"
            onClick={async () => {
              if(confirm(`Delete score for ${student.name}?`)) {
                try {
                  await deleteDoc(doc(db, 'scores', existingScore.id));
                } catch (error) {
                  handleFirestoreError(error, OperationType.DELETE, `scores/${existingScore.id}`);
                }
              }
            }} 
            icon={Trash2}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </td>
    </tr>
  );
}

// --- Score Entry View ---

function SubjectRegistration({ students, subjects, classes }: any) {
  const [selectedClass, setSelectedClass] = useState('');
  const [editingComboStudent, setEditingComboStudent] = useState<any>(null);
  const [tempCombo, setTempCombo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s: any) => s.classId === selectedClass);
  }, [selectedClass, students]);

  const classSubjects = useMemo(() => {
    const cls = classes.find((c: any) => c.id === selectedClass);
    if (!cls) return [];
    return subjects.filter((s: any) => s.curriculum === cls.curriculum);
  }, [selectedClass, subjects, classes]);

  const toggleSubject = async (student: Student, subjectId: string) => {
    const currentSubjects = student.subjectIds || [];
    const newSubjects = currentSubjects.includes(subjectId)
      ? currentSubjects.filter(id => id !== subjectId)
      : [...currentSubjects, subjectId];
    
    try {
      await updateDoc(doc(db, 'students', student.id), { subjectIds: newSubjects });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students/${student.id}`);
    }
  };

  const updateCombination = async (student: Student, combo: string) => {
    try {
      await updateDoc(doc(db, 'students', student.id), { combination: combo });
      setEditingComboStudent(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students/${student.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCombo = () => {
    if (editingComboStudent) {
      updateCombination(editingComboStudent, tempCombo);
    }
  };

  const liveStudent = editingComboStudent ? students.find((s: any) => s.id === editingComboStudent.id) || editingComboStudent : null;

  return (
    <div className="space-y-6 no-print">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Zap size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Subject Registration</h3>
            <p className="text-sm text-gray-500">Assign subjects and UACE combinations to students.</p>
          </div>
        </div>
        <div className="mt-6">
          <Select 
            label="Select Class" 
            value={selectedClass} 
            onChange={(e: any) => setSelectedClass(e.target.value)} 
            options={classes.map((c: any) => ({ label: c.name, value: c.id }))} 
          />
        </div>
      </Card>

      {selectedClass ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-bold text-gray-700 min-w-[200px] sticky left-0 bg-gray-50">Student Name</th>
                {classes.find((c:any)=>c.id === selectedClass)?.curriculum === 'advanced' && (
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 min-w-[150px]">A-Level Combination</th>
                )}
                {classSubjects.map((s: any) => (
                  <th key={s.id} className="px-4 py-8 text-[10px] font-black uppercase text-gray-500 whitespace-nowrap text-center min-w-[120px]">
                    <div className="rotate-[-45deg] origin-center translate-y-4">
                      <div className="text-[8px] font-medium normal-case mb-1 leading-tight text-gray-400">{s.name}</div>
                      <div>{s.code}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student: any) => (
                <tr key={student.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2">
                      <span>{student.name}</span>
                      <button 
                        onClick={() => {
                          setEditingComboStudent(student);
                          setTempCombo(student.combination || '');
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title="Manage Subjects"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                  </td>
                  {student.curriculum === 'advanced' && (
                    <td className="px-6 py-4">
                      <input 
                        type="text" 
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs font-bold uppercase transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        placeholder="e.g. BCM/ICT"
                        defaultValue={student.combination || ''}
                        onBlur={(e) => updateCombination(student, e.target.value)}
                      />
                    </td>
                  )}
                  {classSubjects.map((s: any) => (
                    <td key={s.id} className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        checked={(student.subjectIds || []).includes(s.id)}
                        onChange={() => toggleSubject(student, s.id)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 font-medium">Select a class to manage registrations.</p>
        </div>
      )}

      {/* Combination Edit Modal */}
      <AnimatePresence>
        {editingComboStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingComboStudent(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {liveStudent.curriculum === 'advanced' ? 'A-Level Registration' : 'Subject Registration'}
                  </h3>
                  <p className="text-sm text-gray-500">{liveStudent.name}</p>
                </div>
                <button 
                  onClick={() => setEditingComboStudent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {liveStudent.curriculum === 'advanced' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Subject Combination</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 uppercase focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-gray-300 text-sm"
                      placeholder="e.g. BCM/Sub-ICT"
                      value={tempCombo}
                      onChange={(e) => setTempCombo(e.target.value.toUpperCase())}
                    />
                    <p className="text-[10px] text-gray-400 font-medium italic">Combination determines the official exam registration string.</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Registered Subjects</label>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {(liveStudent.subjectIds || []).length} Selected
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {subjects.filter((s: any) => (liveStudent.subjectIds || []).includes(s.id)).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl group transition-all hover:bg-white hover:border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[10px] font-black text-blue-600 shadow-sm">
                            {s.code}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 leading-none mb-1">{s.name}</p>
                            <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">{s.curriculum} Level Registry</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleSubject(liveStudent, s.id)}
                          className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove Subject"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(liveStudent.subjectIds || []).length === 0 && (
                      <div className="text-center py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-100">
                        <BookOpen className="mx-auto text-gray-200 mb-2" size={32} />
                        <p className="text-xs text-gray-400 font-medium">No subjects currently registered</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setEditingComboStudent(null)}
                >
                  Close
                </Button>
                {liveStudent.curriculum === 'advanced' && (
                  <Button 
                    className="flex-1"
                    icon={isSaving ? Loader2 : Save}
                    onClick={handleSaveCombo}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Combo'}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AttendanceManager({ students, classes, subjects, attendance, profile, schoolSettings }: any) {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedType, setSelectedType] = useState<'class' | 'examination'>('class');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supervisorName, setSupervisorName] = useState(profile?.name || '');
  const [supervisorSignature, setSupervisorSignature] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const currentTerm = schoolSettings[0]?.term || 'Term 1';
  const currentYear = schoolSettings[0]?.year || new Date().getFullYear();

  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s: any) => s.classId === selectedClass);
  }, [selectedClass, students]);

  const classSubjects = useMemo(() => {
    const cls = classes.find((c: any) => c.id === selectedClass);
    if (!cls) return [];
    return subjects.filter((s: any) => s.curriculum === cls.curriculum);
  }, [selectedClass, subjects, classes]);

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    const id = `${studentId}_${selectedType}_${date}${selectedSubject ? '_' + selectedSubject : ''}`;
    try {
      await setDoc(doc(db, 'attendance', id), {
        studentId,
        type: selectedType,
        date,
        status,
        subjectId: selectedSubject || null,
        term: currentTerm,
        year: currentYear,
        supervisorName,
        supervisorSignature,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `attendance/${id}`);
    }
  };

  const currentAttendance = attendance.filter((a: any) => 
    a.date === date && 
    a.type === selectedType && 
    (!selectedSubject || a.subjectId === selectedSubject)
  );

  const downloadPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    const element = printRef.current;
    const opt = {
      margin: 0.5,
      filename: `Attendance_${selectedClass}_${date}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select 
            label="Class" 
            value={selectedClass} 
            onChange={(e: any) => setSelectedClass(e.target.value)} 
            options={classes.map((c: any) => ({ label: c.name, value: c.id }))} 
          />
          <Select 
            label="Attendance Type" 
            value={selectedType} 
            onChange={(e: any) => setSelectedType(e.target.value)} 
            options={[{ label: 'Daily Class', value: 'class' }, { label: 'Examination', value: 'examination' }]} 
          />
          <Input label="Date" type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
          {selectedType === 'examination' && (
            <Select 
              label="Examination Subject" 
              value={selectedSubject} 
              onChange={(e: any) => setSelectedSubject(e.target.value)} 
              options={classSubjects.map((s: any) => ({ label: s.name, value: s.id }))} 
            />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Input label="Supervisor / Teacher Name" value={supervisorName} onChange={(e: any) => setSupervisorName(e.target.value)} />
          <Input label="Signature / Initials" value={supervisorSignature} onChange={(e: any) => setSupervisorSignature(e.target.value)} />
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => window.print()} icon={Printer} disabled={!selectedClass}>Print Attendance Sheet</Button>
          <Button 
            variant="outline" 
            icon={isExporting ? Loader2 : FileDown} 
            disabled={isExporting || !selectedClass}
            onClick={downloadPDF}
          >
            {isExporting ? 'Exporting...' : 'Download PDF'}
          </Button>
        </div>
      </Card>

      {selectedClass ? (
        <Card ref={printRef} className="p-10 bg-white print:shadow-none print:border-none">
          <div className="flex justify-between items-start mb-10 border-b-2 border-gray-900 pb-6">
            <div className="flex items-center gap-4">
              <School size={48} className="text-blue-700" />
              <div>
                <h1 className="text-2xl font-black uppercase text-gray-900">Aputi Secondary School</h1>
                <p className="text-sm font-bold text-blue-700 tracking-widest uppercase">Official Attendance Registry</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Registry No.</p>
              <p className="text-lg font-mono font-bold tracking-tighter">ATT-{date.replace(/-/g, '')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8 text-sm">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-gray-400">Class / Stream</p>
              <p className="font-bold">{classes.find((c:any)=>c.id === selectedClass)?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-gray-400">Date Recorded</p>
              <p className="font-bold">{new Date(date).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-gray-400">Category</p>
              <p className="font-bold uppercase text-blue-700">{selectedType}</p>
            </div>
            {selectedType === 'examination' && (
              <div className="col-span-3 space-y-1">
                <p className="text-[10px] font-black uppercase text-gray-400">Examination Subject</p>
                <p className="font-bold text-lg">{subjects.find((s:any)=>s.id === selectedSubject)?.name || 'General Examination'}</p>
              </div>
            )}
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-2 border-gray-900">
                <th className="border border-gray-900 px-4 py-3 text-[10px] font-black uppercase text-center w-12 text-gray-700">No.</th>
                <th className="border border-gray-900 px-4 py-3 text-[10px] font-black uppercase text-left text-gray-700">Registration</th>
                <th className="border border-gray-900 px-4 py-3 text-[10px] font-black uppercase text-left text-gray-700">Student Name</th>
                <th className={`border border-gray-900 px-4 py-3 text-[10px] font-black uppercase text-center w-32 no-print text-gray-700 ${isExporting ? 'hidden' : ''}`}>Action</th>
                <th className="border border-gray-900 px-4 py-3 text-[10px] font-black uppercase text-center w-24 text-gray-700">Status</th>
                <th className="border border-gray-900 px-4 py-3 text-[10px] font-black uppercase text-center w-40 text-gray-700">Student Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-x border-b border-gray-900">
              {filteredStudents.map((student: any, idx: number) => {
                const record = currentAttendance.find((a: any) => a.studentId === student.id);
                return (
                  <tr key={student.id} className="hover:bg-gray-50/50">
                    <td className="border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-400">{idx + 1}</td>
                    <td className="border border-gray-300 px-4 py-3 font-mono text-xs font-bold text-blue-700">{student.registrationNumber}</td>
                    <td className="border border-gray-300 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                          {student.photoUrl ? (
                            <img 
                              src={student.photoUrl} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-300 font-black uppercase">
                              No Pic
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className={`border border-gray-300 px-4 py-3 no-print ${isExporting ? 'hidden' : ''}`}>
                      <div className="flex justify-center gap-1">
                        <button onClick={() => markAttendance(student.id, 'present')} className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center ${record?.status === 'present' ? 'bg-green-600 border-green-600 text-white shadow-sm' : 'border-gray-100 text-gray-300 hover:border-green-200'}`}><Check size={14}/></button>
                        <button onClick={() => markAttendance(student.id, 'absent')} className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center ${record?.status === 'absent' ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'border-gray-100 text-gray-300 hover:border-red-200'}`}><X size={14}/></button>
                        <button onClick={() => markAttendance(student.id, 'late')} className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center ${record?.status === 'late' ? 'bg-yellow-500 border-yellow-500 text-white shadow-sm' : 'border-gray-100 text-gray-300 hover:border-yellow-200'}`}><Clock size={14}/></button>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      {record ? (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${
                          record.status === 'present' ? 'bg-green-100 text-green-700' :
                          record.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {record.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-200 uppercase font-black tracking-widest">Pending</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-3 italic font-mono text-xs text-gray-400 text-center">
                      {record?.status === 'present' ? 'Acknowledged' : '................'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-16 grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 p-2 rounded w-fit mb-2">Primary Supervisor</p>
                <div className="flex items-end gap-2 border-b-2 border-gray-900 pb-2">
                  <span className="text-sm font-bold bg-white">{supervisorName}</span>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50 p-2 rounded w-fit mb-2">Supervisor's Signature</p>
                <div className="h-10 border-b-2 border-gray-900 italic font-mono text-blue-700 text-xl pl-4">{supervisorSignature}</div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end justify-between">
              <div className="w-48 h-12 border-2 border-dotted border-gray-200 text-[10px] text-gray-300 flex items-center justify-center rounded">STAMP HERE</div>
              <div className="w-full pt-8 border-t-2 border-gray-900">
                <p className="text-sm font-bold text-gray-900 uppercase">Head of Department / Examinations</p>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Aputi Secondary School</p>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <UserCheck className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 font-medium">Select a class to generate attendance sheet.</p>
        </div>
      )}
    </div>
  );
}

function ExamCardGenerator({ students, subjects, classes }: any) {
  const [selectedClass, setSelectedClass] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s: any) => s.classId === selectedClass);
  }, [selectedClass, students]);

  const downloadPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    
    const element = printRef.current;
    const opt = {
      margin: 0.5,
      filename: `ExamCards_${selectedClass}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 no-print">
         <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <Select 
              label="Generate Exam Cards for Class" 
              value={selectedClass} 
              onChange={(e: any) => setSelectedClass(e.target.value)} 
              options={classes.map((c: any) => ({ label: c.name, value: c.id }))} 
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => window.print()} 
              icon={Printer}
              disabled={!selectedClass}
            >
              Print All
            </Button>
            <Button 
              variant="outline"
              onClick={downloadPDF} 
              icon={isExporting ? Loader2 : FileDown}
              disabled={isExporting || !selectedClass}
            >
              {isExporting ? 'Exporting...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Card>

      {selectedClass ? (
        <div ref={printRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 print:block">
          {filteredStudents.map((student: any) => (
            <div key={student.id} className="bg-white border-[3px] border-gray-900 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden page-break-after-always print:mb-12 print:mx-auto print:max-w-md">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-700 rounded-bl-[5rem] -mr-12 -mt-12 opacity-10" />
              
              <div className="flex items-start gap-8 mb-8 pb-8 border-b-2 border-gray-100">
                 <div className="w-32 h-32 rounded-3xl bg-gray-50 border-4 border-white overflow-hidden shadow-xl ring-1 ring-gray-200 flex-shrink-0">
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt={student.name} referrerPolicy="no-referrer" className="w-full h-full object-cover"/>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-200">
                        <User size={48} />
                        <span className="text-[8px] font-black uppercase tracking-widest">No Portrait</span>
                      </div>
                    )}
                 </div>
                 <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <School size={20} className="text-blue-700" />
                      <h2 className="text-xl font-black uppercase text-gray-900 tracking-tighter">Aputi Secondary School</h2>
                    </div>
                    <div className="inline-block px-3 py-1 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                      Examination Card
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Student Name</p>
                      <p className="text-xl font-black text-gray-900 leading-tight">{student.name}</p>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                 <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Registration</p>
                    <p className="text-sm font-mono font-bold text-blue-700">{student.registrationNumber || 'PENDING'}</p>
                 </div>
                 <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Class</p>
                    <p className="text-sm font-bold text-gray-900">{classes.find((c:any)=>c.id === student.classId)?.name}</p>
                 </div>
                 {student.combination && (
                   <div className="col-span-2 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <p className="text-[9px] font-black uppercase text-blue-400 mb-1">Advanced Level Combination</p>
                      <p className="text-sm font-black text-blue-800">{student.combination}</p>
                   </div>
                 )}
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                    <h4 className="text-[10px] font-black uppercase text-gray-900 tracking-widest whitespace-nowrap bg-white px-3 border-2 border-gray-900 rounded-full py-1">Registered Exam Subjects</h4>
                    <div className="h-[2px] w-full bg-gray-100" />
                 </div>
                 <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    {subjects.filter((s:any) => (student.subjectIds || []).includes(s.id)).map((s:any) => (
                      <div key={s.id} className="text-[11px] flex items-center gap-2 font-bold text-gray-700">
                        <CheckCircle2 size={12} className="text-green-600 flex-shrink-0"/>
                        <span className="truncate">{s.name} <span className="text-[9px] text-gray-400 font-mono">({s.code})</span></span>
                      </div>
                    ))}
                    {(student.subjectIds || []).length === 0 && <p className="text-xs italic text-gray-400 col-span-2">No subjects registered yet.</p>}
                 </div>
              </div>

              <div className="mt-12 flex justify-between items-end gap-6 pt-6 border-t border-dashed border-gray-300">
                 <div className="flex-shrink-0 bg-white p-1 rounded-lg border border-gray-100 shadow-sm flex flex-col items-center">
                    <QRCodeCanvas 
                      value={JSON.stringify({
                        name: student.name,
                        reg: student.registrationNumber || 'PENDING',
                        class: classes.find((c: any) => c.id === student.classId)?.name || 'UNKNOWN'
                      })}
                      size={64}
                      level="L"
                    />
                    <p className="text-[6px] font-black text-center mt-1 text-gray-400">VERIFY CARD</p>
                 </div>
                 <div className="text-center flex-1">
                    <div className="h-8 border-b-2 border-gray-900 mb-2"></div>
                    <p className="text-[9px] font-black uppercase text-gray-400">Head Teacher</p>
                 </div>
                 <div className="text-center flex-1">
                    <div className="h-8 border-b-2 border-gray-900 mb-2"></div>
                    <p className="text-[9px] font-black uppercase text-gray-400">School Bursa</p>
                 </div>
                 <div className="flex-shrink-0 w-20 h-20 border-2 border-gray-900 rounded-2xl bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-200">
                    STAMP
                 </div>
              </div>

              <div className="mt-6 text-center">
                 <p className="text-[8px] font-bold text-gray-300 uppercase leading-none italic tracking-tighter">Internal Examination Control Document • Session 2024</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 no-print">
          <IdCard className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 font-medium">Select a class to preview and print cards.</p>
        </div>
      )}
    </div>
  );
}

function ScoreEntry({ scores, students, subjects, classes, profile }: any) {
  const [entryMode, setEntryMode] = useState<'subject' | 'student'>('subject');
  const [assessmentType, setAssessmentType] = useState<'aoi' | 'eot' | 'both'>('both');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [year, setYear] = useState(new Date().getFullYear());
  const [newStudentName, setNewStudentName] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s: any) => s.classId === selectedClass);
  }, [selectedClass, students]);

  const availableSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const cls = classes.find((c: any) => c.id === selectedClass);
    if (!cls) return [];
    
    let filtered = subjects.filter((s: any) => s.curriculum === cls.curriculum);
    
    // If teacher, only show their assigned subjects (if any assigned)
    if (profile.role === 'teacher' && profile.subjects?.length > 0) {
      filtered = filtered.filter((s: any) => profile.subjects.includes(s.id));
    }
    
    return filtered;
  }, [selectedClass, subjects, classes, profile]);

  const handleScoreUpdate = async (studentId: string, subjectId: string, updates: Partial<Score>) => {
    if (!subjectId || !selectedClass) return;
    
    const existingScore = scores.find((s: any) => 
      s.studentId === studentId && 
      s.subjectId === subjectId && 
      s.term === selectedTerm && 
      s.year === year
    );

    const aoi = updates.aoiMarks !== undefined ? Number(updates.aoiMarks) : (existingScore?.aoiMarks || 0);
    const eot = updates.eotMarks !== undefined ? Number(updates.eotMarks) : (existingScore?.eotMarks || 0);
    
    // Total marks is simply aoi + eot since 20 + 80 = 100
    const totalMarks = aoi + eot;

    const scoreData = {
      studentId,
      subjectId: subjectId,
      classId: selectedClass,
      teacherId: profile.uid,
      term: selectedTerm,
      year,
      aoiMarks: aoi,
      eotMarks: eot,
      marks: totalMarks,
      comment: updates.comment !== undefined ? updates.comment : (existingScore?.comment || '')
    };

    try {
      if (existingScore) {
        await updateDoc(doc(db, 'scores', existingScore.id), scoreData);
      } else {
        await addDoc(collection(db, 'scores'), scoreData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'scores');
    }
  };

  const handleQuickAddStudent = async () => {
    if (!newStudentName.trim() || !selectedClass) return;
    
    setIsAddingStudent(true);
    try {
      const cls = classes.find((c: any) => c.id === selectedClass);
      const newStudent = {
        name: newStudentName.trim(),
        classId: selectedClass,
        curriculum: cls?.curriculum || 'lower',
        registrationNumber: `NEW-${Date.now().toString().slice(-6)}`
      };
      await addDoc(collection(db, 'students'), newStudent);
      setNewStudentName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    } finally {
      setIsAddingStudent(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setEntryMode('subject')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${entryMode === 'subject' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          By Subject
        </button>
        <button 
          onClick={() => setEntryMode('student')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${entryMode === 'student' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          By Student
        </button>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select 
            label="Class" 
            value={selectedClass} 
            onChange={(e: any) => {
              setSelectedClass(e.target.value);
              setSelectedStudent('');
            }} 
            options={classes.map((c: any) => ({ label: c.name, value: c.id }))} 
          />
          {entryMode === 'subject' ? (
            <Select 
              label="Subject" 
              value={selectedSubject} 
              onChange={(e: any) => setSelectedSubject(e.target.value)} 
              options={availableSubjects.map((s: any) => ({ label: `${s.code} - ${s.name}`, value: s.id }))} 
            />
          ) : (
            <Select 
              label="Student" 
              value={selectedStudent} 
              onChange={(e: any) => setSelectedStudent(e.target.value)} 
              options={filteredStudents.map((s: any) => ({ label: s.name, value: s.id }))} 
            />
          )}
          <Select 
            label="Term" 
            value={selectedTerm} 
            onChange={(e: any) => setSelectedTerm(e.target.value)} 
            options={[{ label: 'Term 1', value: 'Term 1' }, { label: 'Term 2', value: 'Term 2' }, { label: 'Term 3', value: 'Term 3' }]} 
          />
          <Input label="Year" type="number" value={year} onChange={(e: any) => setYear(Number(e.target.value))} />
          <Select 
            label="Entry Type" 
            value={assessmentType} 
            onChange={(e: any) => setAssessmentType(e.target.value)} 
            options={[
              { label: 'Both (AoI & EoT)', value: 'both' },
              { label: 'AoI Only (Out of 20)', value: 'aoi' },
              { label: 'EoT Only (Out of 80)', value: 'eot' }
            ]} 
          />
        </div>
      </Card>

      {entryMode === 'subject' ? (
        selectedClass && selectedSubject ? (
          <Card>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-sm font-bold text-gray-700">Student Name</th>
                  {(assessmentType === 'aoi' || assessmentType === 'both') && (
                    <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">AoI (/20)</th>
                  )}
                  {(assessmentType === 'eot' || assessmentType === 'both') && (
                    <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">EoT (/80)</th>
                  )}
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">Total (/100)</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">Grade/Competency</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700">Teacher's Comment</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student: any) => {
                  const score = scores.find((s: any) => 
                    s.studentId === student.id && 
                    s.subjectId === selectedSubject && 
                    s.term === selectedTerm && 
                    s.year === year
                  );
                  return (
                    <ScoreRow 
                      key={student.id}
                      student={student}
                      subjectId={selectedSubject}
                      term={selectedTerm}
                      year={year}
                      assessmentType={assessmentType}
                      existingScore={score}
                      onUpdate={handleScoreUpdate}
                      profile={profile}
                    />
                  );
                })}
                
                {/* Quick Add Student Row */}
                <tr className="bg-blue-50/30 border-t-2 border-blue-100">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                        <User size={14} />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Add new student name..."
                        className="w-full px-3 py-1.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm bg-white"
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickAddStudent();
                        }}
                        disabled={isAddingStudent}
                      />
                    </div>
                  </td>
                  {(assessmentType === 'aoi' || assessmentType === 'both') && <td className="px-6 py-4"></td>}
                  {(assessmentType === 'eot' || assessmentType === 'both') && <td className="px-6 py-4"></td>}
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      size="sm" 
                      onClick={handleQuickAddStudent} 
                      disabled={!newStudentName.trim() || isAddingStudent}
                      icon={isAddingStudent ? Loader2 : Plus}
                      className={isAddingStudent ? 'animate-pulse' : ''}
                    >
                      {isAddingStudent ? 'Adding...' : 'Add Student'}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
            <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-gray-500">Please select a class and subject to enter scores.</p>
          </div>
        )
      ) : (
        selectedClass && selectedStudent ? (
          <Card>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-sm font-bold text-gray-700">Subject</th>
                  {(assessmentType === 'aoi' || assessmentType === 'both') && (
                    <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">AoI (/20)</th>
                  )}
                  {(assessmentType === 'eot' || assessmentType === 'both') && (
                    <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">EoT (/80)</th>
                  )}
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">Total (/100)</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700 text-center">Grade/Competency</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-700">Teacher's Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {availableSubjects.map((subject: any) => {
                  const score = scores.find((s: any) => 
                    s.studentId === selectedStudent && 
                    s.subjectId === subject.id && 
                    s.term === selectedTerm && 
                    s.year === year
                  );
                  const student = students.find((s: any) => s.id === selectedStudent);
                  return (
                    <tr key={subject.id}>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{subject.name}</p>
                        <p className="text-xs text-gray-400">{subject.code}</p>
                      </td>
                      {(assessmentType === 'aoi' || assessmentType === 'both') && (
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="number" 
                            min="0" 
                            max="20"
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-center"
                            defaultValue={score?.aoiMarks || ''}
                            onBlur={(e) => handleScoreUpdate(selectedStudent, subject.id, { aoiMarks: Number(e.target.value) })}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Conv: {((score?.aoiMarks || 0) / 20 * 3).toFixed(1)}
                          </p>
                        </td>
                      )}
                      {(assessmentType === 'eot' || assessmentType === 'both') && (
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="number" 
                            min="0" 
                            max="80"
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-center"
                            defaultValue={score?.eotMarks || ''}
                            onBlur={(e) => handleScoreUpdate(selectedStudent, subject.id, { eotMarks: Number(e.target.value) })}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Conv: {((score?.eotMarks || 0) / 80 * 3).toFixed(1)}
                          </p>
                        </td>
                      )}
                      <td className="px-6 py-4 text-center font-bold text-gray-700">
                        {score?.marks || 0}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          (score?.marks || 0) >= 75 ? 'bg-green-50 text-green-600' :
                          (score?.marks || 0) >= 40 ? 'bg-orange-50 text-orange-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {getGrade(score?.marks, student?.curriculum || 'lower')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          placeholder="Add comment..."
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none text-sm"
                          defaultValue={score?.comment || ''}
                          onBlur={(e) => handleScoreUpdate(selectedStudent, subject.id, { comment: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
            <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
            <p className="text-gray-500">Please select a class and student to enter scores.</p>
          </div>
        )
      )}
    </div>
  );
}

function getGrade(marks: number | undefined, curriculum: string) {
  if (marks === undefined) return '-';
  if (curriculum === 'lower') {
    const scoreOutOf3 = (marks / 100 * 3);
    if (scoreOutOf3 >= 2.5) return '3 (Outstanding)';
    if (scoreOutOf3 >= 1.5) return '2 (Moderate)';
    return '1 (Basic)';
  } else {
    if (marks >= 80) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 50) return 'D';
    if (marks >= 40) return 'E';
    if (marks >= 35) return 'O';
    return 'F';
  }
}

// --- Settings Manager ---

function SettingsManager({ schoolSettings }: { schoolSettings: SchoolSettings[] }) {
  const [formData, setFormData] = useState({
    term: 'Term 1',
    year: new Date().getFullYear(),
    breakingOffDate: '',
    reportingDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentSettings = schoolSettings.find(s => s.term === formData.term && s.year === formData.year);

  useEffect(() => {
    if (currentSettings) {
      setFormData({
        term: currentSettings.term,
        year: currentSettings.year,
        breakingOffDate: currentSettings.breakingOffDate,
        reportingDate: currentSettings.reportingDate,
        headteacherComment: currentSettings.headteacherComment || ''
      });
    } else {
      setFormData(prev => ({ ...prev, breakingOffDate: '', reportingDate: '', headteacherComment: '' }));
    }
    setSaved(false);
  }, [currentSettings, formData.term, formData.year]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const id = `${formData.term}_${formData.year}`;
    try {
      await setDoc(doc(db, 'school_settings', id), formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `school_settings/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <Settings size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">School Term Settings</h3>
          <p className="text-sm text-gray-500">Manage dates and term information for report cards.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Select 
            label="Term" 
            value={formData.term} 
            onChange={(e: any) => setFormData({ ...formData, term: e.target.value })} 
            options={[{ label: 'Term 1', value: 'Term 1' }, { label: 'Term 2', value: 'Term 2' }, { label: 'Term 3', value: 'Term 3' }]} 
          />
          <Input 
            label="Year" 
            type="number" 
            value={formData.year} 
            onChange={(e: any) => setFormData({ ...formData, year: Number(e.target.value) })} 
          />
        </div>
        
        <div className="space-y-4">
          <Input 
            label="Date for Breaking Off" 
            type="date" 
            value={formData.breakingOffDate} 
            onChange={(e: any) => setFormData({ ...formData, breakingOffDate: e.target.value })} 
            required
          />
          <Input 
            label="Date for Reporting (Next Term)" 
            type="date" 
            value={formData.reportingDate} 
            onChange={(e: any) => setFormData({ ...formData, reportingDate: e.target.value })} 
            required
          />
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase">General Headteacher's Comment</p>
            <textarea
              className="w-full p-3 text-sm italic text-gray-600 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Enter a general comment from the headteacher that will appear on all report cards unless a specific one is provided..."
              value={formData.headteacherComment || ''}
              onChange={(e) => setFormData({ ...formData, headteacherComment: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : 'Save Settings'}
          </Button>
          {saved && (
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-green-600 text-sm font-bold flex items-center gap-2"
            >
              <ClipboardCheck size={16} />
              Settings Saved!
            </motion.p>
          )}
        </div>
      </form>
    </Card>
  );
}

// --- Report Generator ---

function ReportGenerator({ students, scores, subjects, classes, termComments, profile, schoolSettings }: any) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [year, setYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'single' | 'class'>('single');

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s: any) => s.classId === selectedClass);
  }, [selectedClass, students]);

  const getStudentData = (studentId: string) => {
    const student = students.find((s: any) => s.id === studentId);
    const studentScores = scores.filter((s: any) => 
      s.studentId === studentId && 
      s.term === selectedTerm && 
      s.year === year
    );
    const cls = classes.find((c: any) => c.id === student?.classId);
    const comment = termComments.find((tc: any) => 
      tc.studentId === studentId && 
      tc.term === selectedTerm && 
      tc.year === year
    );
    const settings = schoolSettings.find((s: any) => s.term === selectedTerm && s.year === year);
    return { student, scores: studentScores, class: cls, termComment: comment, settings };
  };

  useEffect(() => {
    if (profile?.role === 'student' && profile.studentId) {
      setSelectedStudent(profile.studentId);
      setViewMode('single');
    }
  }, [profile]);

  const studentData = useMemo(() => {
    if (viewMode === 'single' && selectedStudent) {
      return getStudentData(selectedStudent);
    }
    return null;
  }, [selectedStudent, selectedTerm, year, students, scores, classes, termComments, schoolSettings, viewMode]);

  const handleTermCommentUpdate = async (field: string, value: string, studentId: string, currentComment: any) => {
    const commentId = currentComment?.id || `${studentId}_${selectedTerm}_${year}`;
    const commentRef = doc(db, 'term_comments', commentId);
    
    if (field === 'delete') {
      if (!confirm("Clear all comments for this student for this term?")) return;
      try {
        await deleteDoc(commentRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `term_comments/${commentId}`);
      }
      return;
    }

    try {
      await setDoc(commentRef, {
        studentId: studentId,
        term: selectedTerm,
        year: year,
        [field]: value,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `term_comments/${commentId}`);
    }
  };

  const ReportCard = ({ data, isBulk = false }: { data: any, isBulk?: boolean, key?: any }) => {
    if (!data || !data.student) return null;

    return (
      <Card className={`p-12 bg-white shadow-2xl max-w-5xl mx-auto border-t-[12px] border-t-blue-700 relative overflow-hidden ${isBulk ? 'mb-12 page-break-after-always' : ''}`}>
        {/* Subtle Watermark */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center rotate-[-30deg] select-none">
          <h1 className="text-[12rem] font-black uppercase whitespace-nowrap">Aputi SS</h1>
        </div>

        {/* Header Section */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-4 mb-12 border-b-2 border-gray-900 pb-10">
          <div className="flex items-center gap-8 w-full justify-center">
            <img 
              src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=240&h=240&auto=format&fit=crop" 
              alt="Aputi SS Badge" 
              className="w-28 h-28 object-contain rounded-full border-4 border-blue-700 p-1 bg-white shadow-lg"
              referrerPolicy="no-referrer"
            />
            <div className="text-left space-y-1">
              <h1 className="text-5xl font-black text-gray-900 uppercase tracking-tighter leading-none">Aputi Secondary School</h1>
              <p className="text-lg font-bold text-blue-700 tracking-widest uppercase">"Education for a Brighter Future"</p>
              <div className="flex gap-4 text-sm font-bold text-gray-500 uppercase tracking-wider pt-2">
                <span className="flex items-center gap-1"><School size={14} /> P.O. Box 45, Amolatar</span>
                <span className="flex items-center gap-1"><MessageSquare size={14} /> 0772-XXXXXX</span>
              </div>
            </div>
          </div>
          
          <div className="w-full flex justify-between items-end pt-6">
            <div className="text-left">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-[0.2em]">Student Progress Report</h2>
              <p className="text-gray-500 font-bold uppercase tracking-widest">{selectedTerm} • Academic Year {year}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-gray-900 overflow-hidden shadow-sm bg-gray-50 flex-shrink-0">
                {data.student.photoUrl ? (
                  <img 
                    src={data.student.photoUrl} 
                    alt="Thumbnail" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <User size={24} />
                  </div>
                )}
              </div>
              <div className="inline-block px-4 py-2 bg-gray-900 text-white rounded-lg font-black text-[10px] uppercase tracking-widest whitespace-nowrap">
                Official Document
              </div>
            </div>
          </div>
        </div>

        {/* Student Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12 relative z-10">
          <div className="md:col-span-2 flex items-start gap-8 bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="w-40 h-40 rounded-[2rem] bg-white border-4 border-white overflow-hidden flex-shrink-0 shadow-2xl ring-1 ring-gray-200">
              {data.student.photoUrl ? (
                <img 
                  src={data.student.photoUrl} 
                  alt={data.student.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-200 bg-gray-50">
                  <User size={64} />
                  <p className="text-[10px] font-black uppercase mt-2 tracking-widest opacity-50">No Photo</p>
                </div>
              )}
            </div>
            <div className="space-y-6 flex-1">
              <div>
                <p className="text-[11px] uppercase font-black text-blue-600 tracking-[0.2em] mb-2">Full Name of Student</p>
                <p className="text-4xl font-black text-gray-900 leading-tight tracking-tight">{data.student.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em] mb-1">Registration No.</p>
                  <p className="text-lg font-bold text-gray-800 font-mono">{data.student.registrationNumber || 'PENDING'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em] mb-1">Gender</p>
                  <p className="text-lg font-bold text-gray-800 uppercase">Not Specified</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-white rounded-3xl border-2 border-gray-900 shadow-sm">
              <p className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em] mb-1">Class / Stream</p>
              <p className="text-3xl font-black text-gray-900">{data.class?.name}</p>
            </div>
            <div className="p-6 bg-blue-700 rounded-3xl text-white shadow-lg shadow-blue-100">
              <p className="text-[11px] uppercase font-black opacity-60 tracking-[0.2em] mb-1">Curriculum Type</p>
              <p className="text-2xl font-black uppercase">{data.student.curriculum} Secondary</p>
            </div>
          </div>
        </div>

        {/* Performance Table */}
        <div className="mb-12 relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-xs font-black uppercase text-gray-900 tracking-[0.3em] whitespace-nowrap bg-gray-100 px-4 py-2 rounded-full">Academic Performance Details</h3>
            <div className="h-[1px] w-full bg-gray-200" />
          </div>
          
          <div className="overflow-hidden rounded-3xl border-2 border-gray-900 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest">Subject Description</th>
                  <th className="px-4 py-5 text-[11px] font-black uppercase tracking-widest text-center">CBA (20%)</th>
                  <th className="px-4 py-5 text-[11px] font-black uppercase tracking-widest text-center">EoT (80%)</th>
                  <th className="px-4 py-5 text-[11px] font-black uppercase tracking-widest text-center">Total (100%)</th>
                  <th className="px-4 py-5 text-[11px] font-black uppercase tracking-widest text-center">Descriptor</th>
                  <th className="px-6 py-5 text-[11px] font-black uppercase tracking-widest text-right">Competency / Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-900">
                {data.scores.map((score: any) => {
                  const subject = subjects.find((s: any) => s.id === score.subjectId);
                  const aoiConv = ((score.aoiMarks || 0) / 20 * 3).toFixed(1);
                  const eotConv = ((score.eotMarks || 0) / 80 * 3).toFixed(1);
                  return (
                    <tr key={score.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-6">
                        <p className="text-lg font-black text-gray-900 leading-none mb-1">{subject?.name}</p>
                        <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">{subject?.code}</p>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <p className="text-xl font-black text-gray-900">{score.aoiMarks || 0}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Score: {aoiConv}</p>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <p className="text-xl font-black text-gray-900">{score.eotMarks || 0}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Score: {eotConv}</p>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xl font-black text-gray-900">{score.marks}%</span>
                          <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${score.marks}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <span className="text-sm font-black text-blue-700 drop-shadow-sm leading-tight block">{getGrade(score.marks, data.student.curriculum)}</span>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <p className="text-[11px] font-bold text-gray-900 mb-1">{score.competency || 'Competency achieved.'}</p>
                        <p className="text-[10px] font-medium italic text-gray-500 max-w-[220px] ml-auto leading-relaxed">
                          "{score.comment || 'Satisfactory progress observed.'}"
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-16 relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-xs font-black uppercase text-gray-900 tracking-[0.3em] whitespace-nowrap bg-gray-100 px-4 py-2 rounded-full">Executive Summary</h3>
            <div className="h-[1px] w-full bg-gray-200" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 bg-blue-700 rounded-[3rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp size={140} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60 mb-4">Average Score</p>
              <div className="flex items-baseline gap-1">
                <p className="text-7xl font-black tracking-tighter">
                  {data.scores.length > 0 
                    ? Math.round(data.scores.reduce((acc: number, s: any) => acc + s.marks, 0) / data.scores.length) 
                    : 0}
                </p>
                <span className="text-3xl font-black opacity-40">%</span>
              </div>
            </div>

            <div className="p-10 bg-gray-900 rounded-[3rem] text-white shadow-2xl shadow-gray-200 relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <BookOpen size={140} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60 mb-4">Subjects Evaluated</p>
              <p className="text-7xl font-black tracking-tighter">{data.scores.length}</p>
            </div>

            <div className="p-10 bg-white rounded-[3rem] border-[6px] border-blue-700 text-blue-700 shadow-2xl shadow-blue-50 relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Award size={140} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-60 mb-4">Overall Descriptor</p>
              <p className="text-4xl font-black tracking-tighter">
                {getGrade(
                  data.scores.length > 0 
                    ? data.scores.reduce((acc: number, s: any) => acc + s.marks, 0) / data.scores.length 
                    : undefined, 
                  data.student.curriculum
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Grading Legend & Generic Skills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12 relative z-10">
          <div className="space-y-6">
            <h4 className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em]">Grading Legend (New Curriculum)</h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center font-black">3</div>
                <div>
                  <p className="text-sm font-black text-gray-900">Outstanding (2.5 - 3.0)</p>
                  <p className="text-[10px] text-gray-500">Learner has fully achieved the competencies.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-blue-400 text-white flex items-center justify-center font-black">2</div>
                <div>
                  <p className="text-sm font-black text-gray-900">Moderate (1.5 - 2.4)</p>
                  <p className="text-[10px] text-gray-500">Learner has achieved most competencies.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-gray-400 text-white flex items-center justify-center font-black">1</div>
                <div>
                  <p className="text-sm font-black text-gray-900">Basic (0.9 - 1.4)</p>
                  <p className="text-[10px] text-gray-500">Learner has achieved basic competencies.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em]">Generic Skills & Values</h4>
            <div className="space-y-4">
              <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                <p className="text-[10px] uppercase font-black text-blue-600 tracking-widest mb-2">Generic Skills</p>
                {profile?.role === 'admin' || profile?.role === 'teacher' ? (
                  <textarea
                    className="w-full bg-transparent text-sm font-medium text-gray-700 focus:outline-none no-print resize-none"
                    rows={2}
                    placeholder="Communication, Cooperation, Critical Thinking..."
                    value={data.termComment?.genericSkills || ''}
                    onChange={(e) => handleTermCommentUpdate('genericSkills', e.target.value, data.student.id, data.termComment)}
                  />
                ) : null}
                <p className="text-sm font-medium text-gray-700 hidden print:block">
                  {data.termComment?.genericSkills || 'Demonstrated good cooperation and communication skills.'}
                </p>
                {!profile && (
                  <p className="text-sm font-medium text-gray-700">
                    {data.termComment?.genericSkills || 'Demonstrated good cooperation and communication skills.'}
                  </p>
                )}
              </div>
              <div className="p-6 bg-purple-50/50 rounded-3xl border border-purple-100">
                <p className="text-[10px] uppercase font-black text-purple-600 tracking-widest mb-2">Values & Attitudes</p>
                {profile?.role === 'admin' || profile?.role === 'teacher' ? (
                  <textarea
                    className="w-full bg-transparent text-sm font-medium text-gray-700 focus:outline-none no-print resize-none"
                    rows={2}
                    placeholder="Respect, Integrity, Responsibility..."
                    value={data.termComment?.values || ''}
                    onChange={(e) => handleTermCommentUpdate('values', e.target.value, data.student.id, data.termComment)}
                  />
                ) : null}
                <p className="text-sm font-medium text-gray-700 hidden print:block">
                  {data.termComment?.values || 'Shows respect for others and takes responsibility.'}
                </p>
                {!profile && (
                  <p className="text-sm font-medium text-gray-700">
                    {data.termComment?.values || 'Shows respect for others and takes responsibility.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-16 relative z-10">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em]">Class Teacher's Assessment</h4>
              {data.termComment && (profile?.role === 'admin' || profile?.role === 'teacher') && (
                <button 
                  onClick={() => handleTermCommentUpdate('delete', '', data.student.id, data.termComment)}
                  className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-widest flex items-center gap-1 no-print"
                >
                  <Trash2 size={12} /> Reset
                </button>
              )}
            </div>
            <div className="p-8 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 min-h-[160px] relative">
              {profile?.role === 'admin' || profile?.role === 'teacher' ? (
                <textarea
                  className="w-full h-full bg-transparent text-lg italic text-gray-700 focus:outline-none no-print resize-none"
                  rows={4}
                  placeholder="Type class teacher's assessment here..."
                  value={data.termComment?.teacherComment || ''}
                  onChange={(e) => handleTermCommentUpdate('teacherComment', e.target.value, data.student.id, data.termComment)}
                />
              ) : null}
              <p className="text-lg italic text-gray-700 hidden print:block leading-relaxed">
                {data.termComment?.teacherComment || 'No assessment recorded for this term.'}
              </p>
              {!profile && (
                <p className="text-lg italic text-gray-700 leading-relaxed">
                  {data.termComment?.teacherComment || 'No assessment recorded for this term.'}
                </p>
              )}
              <div className="absolute bottom-6 right-8 text-[10px] font-black uppercase text-gray-300 tracking-widest">Signature Required</div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[11px] uppercase font-black text-gray-400 tracking-[0.2em]">Headteacher's Final Remark</h4>
            <div className="p-8 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 min-h-[160px] relative">
              {profile?.role === 'admin' ? (
                <textarea
                  className="w-full h-full bg-transparent text-lg italic text-gray-700 focus:outline-none no-print resize-none"
                  rows={4}
                  placeholder="Type headteacher's remark here..."
                  value={data.termComment?.headteacherComment || data.settings?.headteacherComment || ''}
                  onChange={(e) => handleTermCommentUpdate('headteacherComment', e.target.value, data.student.id, data.termComment)}
                />
              ) : null}
              <p className="text-lg italic text-gray-700 hidden print:block leading-relaxed">
                {data.termComment?.headteacherComment || data.settings?.headteacherComment || 'No remark recorded for this term.'}
              </p>
              <div className="absolute bottom-6 right-8 text-[10px] font-black uppercase text-gray-300 tracking-widest">Official Stamp & Sign</div>
            </div>
          </div>
        </div>

        {/* Footer Dates & Signatures */}
        <div className="mt-16 pt-12 border-t-4 border-gray-900 grid grid-cols-2 gap-12 relative z-10">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em]">Breaking Off</p>
              <p className="text-lg font-black text-gray-900">
                {data.settings?.breakingOffDate 
                  ? new Date(data.settings.breakingOffDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'DD / MM / YYYY'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em]">Next Term Begins</p>
              <p className="text-lg font-black text-gray-900 text-blue-700">
                {data.settings?.reportingDate 
                  ? new Date(data.settings.reportingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'DD / MM / YYYY'}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end items-center gap-12">
            <div className="text-center">
              <div className="w-32 h-1 bg-gray-900 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Class Teacher</p>
            </div>
            <div className="text-center">
              <div className="w-32 h-1 bg-gray-900 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Headteacher</p>
            </div>
          </div>
        </div>

        {/* Grading Range Summary */}
        <div className="mt-12 p-8 bg-gray-50 rounded-[2.5rem] border-2 border-gray-200 relative z-10">
          <h3 className="text-[11px] font-black uppercase text-gray-400 mb-6 tracking-[0.2em]">Grading Reference Table</h3>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest">Lower Secondary (S1 - S4)</p>
              <div className="grid grid-cols-1 gap-2 text-[10px]">
                {GRADING_RANGES.lower.map((r, i) => (
                  <div key={i} className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="font-bold w-16 text-gray-600">{r.range}</span>
                    <span className="font-black text-blue-700 w-8 text-center">{r.grade}</span>
                    <span className="text-gray-400 font-medium italic flex-1 text-right">{r.remark}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest">Upper Secondary (S5 - S6)</p>
              <div className="grid grid-cols-1 gap-2 text-[10px]">
                {GRADING_RANGES.upper.map((r, i) => (
                  <div key={i} className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="font-bold w-16 text-gray-600">{r.range}</span>
                    <span className="font-black text-blue-700 w-8 text-center">{r.grade}</span>
                    <span className="text-gray-400 font-medium italic flex-1 text-right">{r.remark}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {!isBulk && (
          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-center no-print relative z-10">
            <Button onClick={() => window.print()} icon={FileText} className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-6 rounded-2xl shadow-xl shadow-blue-100 font-black uppercase tracking-widest">Print Official Report</Button>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Uganda School Management System • Aputi SS</p>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {profile?.role !== 'student' && (
        <Card className="p-6 no-print">
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase">View Mode</p>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('single')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Single
                  </button>
                  <button 
                    onClick={() => setViewMode('class')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'class' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Class
                  </button>
                </div>
              </div>
              {viewMode === 'single' ? (
                <Select 
                  label="Student" 
                  value={selectedStudent} 
                  onChange={(e: any) => setSelectedStudent(e.target.value)} 
                  options={students.map((s: any) => ({ label: s.name, value: s.id }))} 
                />
              ) : (
                <Select 
                  label="Class" 
                  value={selectedClass} 
                  onChange={(e: any) => setSelectedClass(e.target.value)} 
                  options={classes.map((c: any) => ({ label: c.name, value: c.id }))} 
                />
              )}
              <Select 
                label="Term" 
                value={selectedTerm} 
                onChange={(e: any) => setSelectedTerm(e.target.value)} 
                options={[{ label: 'Term 1', value: 'Term 1' }, { label: 'Term 2', value: 'Term 2' }, { label: 'Term 3', value: 'Term 3' }]} 
              />
              <Input label="Year" type="number" value={year} onChange={(e: any) => setYear(Number(e.target.value))} />
            </div>
            {viewMode === 'class' && selectedClass && (
              <Button onClick={() => window.print()} icon={FileText} className="w-full md:w-auto">Print All Reports</Button>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-12">
        {profile?.role === 'student' ? (
          studentData ? (
            <ReportCard data={studentData} />
          ) : (
            <Card className="p-12 text-center">
              <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
              <p className="text-gray-500 font-bold">Loading your report card...</p>
            </Card>
          )
        ) : viewMode === 'single' ? (
          studentData ? (
            <ReportCard data={studentData} />
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <FileText className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-gray-500">Select a student to view their report card.</p>
            </div>
          )
        ) : (
          selectedClass ? (
            classStudents.length > 0 ? (
              classStudents.map((student: any) => (
                <ReportCard key={student.id} data={getStudentData(student.id)} isBulk={true} />
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                <Users className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-gray-500">No students found in this class.</p>
              </div>
            )
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <GraduationCap className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-gray-500">Select a class to generate all report cards.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
