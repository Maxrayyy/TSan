import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore.js';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoading, error } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await register(nickname, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-green-900 text-white">
      <h1 className="mb-8 text-4xl font-bold">宿松拖三</h1>

      <form
        onSubmit={handleSubmit}
        className="flex w-80 flex-col gap-4 rounded-xl bg-green-800 p-6"
      >
        <h2 className="text-center text-xl font-semibold">{isRegister ? '注册' : '登录'}</h2>

        {isRegister && (
          <input
            type="text"
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="rounded-lg bg-green-700 px-4 py-2 text-white placeholder-green-400 outline-none focus:ring-2 focus:ring-yellow-500"
            maxLength={20}
            required
          />
        )}

        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg bg-green-700 px-4 py-2 text-white placeholder-green-400 outline-none focus:ring-2 focus:ring-yellow-500"
          required
        />

        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg bg-green-700 px-4 py-2 text-white placeholder-green-400 outline-none focus:ring-2 focus:ring-yellow-500"
          minLength={8}
          required
        />

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-yellow-500 py-2 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
        >
          {isLoading ? '处理中...' : isRegister ? '注册' : '登录'}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            useAuthStore.setState({ error: null });
          }}
          className="text-center text-sm text-green-300 hover:text-white"
        >
          {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-center text-sm text-green-400 hover:text-white"
        >
          返回首页
        </button>
      </form>
    </div>
  );
}
