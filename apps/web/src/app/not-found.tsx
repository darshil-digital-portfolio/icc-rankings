import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center justify-center py-32 text-center">
      <p className="text-6xl">🏏</p>
      <h1 className="mt-6 text-4xl font-extrabold text-slate-800">404</h1>
      <p className="mt-3 text-lg text-slate-500">
        This page is out of bounds — like a six into the stands.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-pitch-600 px-6 py-3 text-sm font-bold text-white shadow transition-all hover:bg-pitch-700"
      >
        Back to home
      </Link>
    </div>
  );
}
