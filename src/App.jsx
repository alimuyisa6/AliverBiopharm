import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Home() { return <div>Home works</div>; }
function Login() { return <div>Login</div>; }
function Register() { return <div>Register</div>; }
function NotePage() { return <div>Note</div>; }

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
