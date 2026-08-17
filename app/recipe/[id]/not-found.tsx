export default function RecipeNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-white mb-2">
        Recipe Not Found
      </h1>
      <p className="text-white/60">
        This recipe is unavailable or does not exist.
      </p>
    </main>
  );
}
