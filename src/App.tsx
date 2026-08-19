import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { TeacherLoginPage } from './pages/TeacherLoginPage';
import { TeacherHomePage } from './pages/TeacherHomePage';
import { TeacherRoomPage } from './pages/TeacherRoomPage';
import { StudentJoinPage } from './pages/StudentJoinPage';
import { StudentGamePage } from './pages/StudentGamePage';
import { RankingPage } from './pages/RankingPage';

/**
 * 교사용 화면과 학생용 화면을 주소로 확실히 나눈다.
 *  /teacher... 교사용
 *  /play...    학생용
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/teacher" element={<TeacherHomePage />} />
        <Route path="/teacher/room/:roomId" element={<TeacherRoomPage />} />

        <Route path="/play" element={<StudentJoinPage />} />
        <Route path="/play/:roomId" element={<StudentGamePage />} />

        <Route path="/ranking" element={<RankingPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
