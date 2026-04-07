export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-green-900 text-white">
      <h1 className="mb-8 text-5xl font-bold">宿松拖三</h1>
      <div className="flex flex-col gap-4">
        <button className="rounded-lg bg-yellow-500 px-8 py-3 text-lg font-semibold text-black hover:bg-yellow-400">
          快速开始
        </button>
        <button className="rounded-lg border border-white px-8 py-3 text-lg hover:bg-white/10">
          登录 / 注册
        </button>
      </div>
    </div>
  );
}
