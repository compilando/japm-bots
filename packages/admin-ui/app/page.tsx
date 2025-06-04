import GlassCard from "@/components/GlassCard";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-start pt-8">
      <GlassCard className="max-w-2xl w-full">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Dashboard Principal</h1>
          <p className="text-slate-200">
            Bienvenido al panel de administración del sistema de bots.
          </p>
          <p className="mt-4 text-sm text-slate-300">
            Selecciona una opción de la barra lateral para comenzar.
          </p>
          {/* Aquí se podrían mostrar estadísticas generales o accesos directos en el futuro */}
        </div>
      </GlassCard>
    </div>
  );
}
