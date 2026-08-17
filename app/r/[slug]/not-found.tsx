export default function SharePageNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-white mb-2">
        Recipe Not Found
      </h1>
      <p className="text-white/60">
        This recipe does not exist or the link may be incorrect.
      </p>
    </main>
  );
}
