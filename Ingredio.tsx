import React, { useState, useEffect, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT INITIALISIERUNG
// ============================================
const supabaseUrl = 'https://lgeznkhgvbrtrwowugyi.supabase.co/rest/v1/';
const supabaseKey = 'sb_publishable_nEwvenz4iQELOGUd61q5gg_TF79VGMJ';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// FARBEN-Schema (appetitlich & minimalistisch)
// ============================================
const FARBEN = {
  grün: {
    bg: "bg-emerald-500",
    text: "text-white",
    border: "border-emerald-600",
    label: "✓ In Gericht"
  },
  gelb: {
    bg: "bg-amber-400",
    text: "text-stone-900",
    border: "border-amber-500",
    label: "⚬ Region"
  },
  rot: {
    bg: "bg-rose-400",
    text: "text-white",
    border: "border-rose-500",
    label: "✗ Kein Bezug"
  }
};

// ============================================
// TYPES
// ============================================
type SpielStatus = "spielend" | "gewonnen" | "verloren";
type ZutatStatus = "grün" | "gelb" | "rot";

interface GerateneZutat {
  name: string;
  status: ZutatStatus;
}

// Interface für das Puzzle aus der Datenbank
interface DailyPuzzle {
  id: number;
  date: string;
  dish_name: string;
  cuisine: string;
  exact_ingredients: string[];
  regional_ingredients: string[];
}

// ============================================
// KOMPONENTE: Ingredio
// ============================================
export default function Ingredio() {
  // --- State für Supabase-Daten ---
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- State für Spiel-Logik ---
  const [inputWert, setInputWert] = useState("");
  const [gerateneZutaten, setGerateneZutaten] = useState<GerateneZutat[]>([]);
  const [spielStatus, setSpielStatus] = useState<SpielStatus>("spielend");
  const [losungsModalOffen, setLosungsModalOffen] = useState(false);
  const [losungsInput, setLosungsInput] = useState("");
  const [feedbackNachricht, setFeedbackNachricht] = useState("");
  const [maxVersuche] = useState(6);
  const [versuche, setVersuche] = useState(0);

  // ============================================
  // EFFECT: Heutiges Puzzle aus Supabase laden
  // ============================================
  useEffect(() => {
    const loadDailyPuzzle = async () => {
      try {
        // Heutiges Datum im Format YYYY-MM-DD ermitteln
        const today = new Date().toISOString().split('T')[0];

        // Puzzle aus der Datenbank abrufen
        const { data, error: fetchError } = await supabase
          .from('daily_puzzles')
          .select('*')
          .eq('date', today)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError("Für heute ist leider kein Rätsel in der Datenbank hinterlegt.");
          setIsLoading(false);
          return;
        }

        setPuzzle(data);
        setIsLoading(false);
      } catch (err) {
        console.error("Fehler beim Laden des Puzzles:", err);
        setError("Für heute ist leider kein Rätsel in der Datenbank hinterlegt.");
        setIsLoading(false);
      }
    };

    loadDailyPuzzle();
  }, []);

  // --- Effekt: Feedback-Nachricht nach 2 Sekunden löschen ---
  useEffect(() => {
    if (feedbackNachricht) {
      const timer = setTimeout(() => setFeedbackNachricht(""), 2500);
      return () => clearTimeout(timer);
    }
  }, [feedbackNachricht]);

  // --- Funktion: Zutat eingeben ---
  const handleZutatEingeben = useCallback(() => {
    if (!puzzle) return;

    const zutat = inputWert.toLowerCase().trim();

    if (!zutat) return;

    // Prüfe auf Duplikate
    if (gerateneZutaten.some((z) => z.name === zutat)) {
      setFeedbackNachricht("Diese Zutat hast du schon eingegeben!");
      setInputWert("");
      return;
    }

    // Prüfe Status - nutzt jetzt puzzle.exact_ingredients und puzzle.regional_ingredients
    let status: ZutatStatus;
    if (puzzle.exact_ingredients.includes(zutat)) {
      status = "grün";
    } else if (puzzle.regional_ingredients.includes(zutat)) {
      status = "gelb";
    } else {
      status = "rot";
    }

    setGerateneZutaten((prev) => [...prev, { name: zutat, status }]);
    setInputWert("");

    // Versuch hochzählen
    setVersuche((v) => v + 1);
  }, [inputWert, gerateneZutaten, puzzle]);

  // --- Funktion: Enter-Taste behandeln ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleZutatEingeben();
    }
  };

  // --- Funktion: Lösung raten ---
  const handleLösungAbgeben = useCallback(() => {
    if (!puzzle) return;

    const losung = losungsInput.toLowerCase().trim();

    if (!losung) return;

    // Vergleicht mit puzzle.dish_name
    if (losung === puzzle.dish_name.toLowerCase()) {
      setSpielStatus("gewonnen");
      setLosungsModalOffen(false);
    } else {
      setSpielStatus("verloren");
      setLosungsModalOffen(false);
    }
  }, [losungsInput, puzzle]);

  // --- Funktion: Neues Spiel ---
  const neuesSpiel = () => {
    setGerateneZutaten([]);
    setSpielStatus("spielend");
    setVersuche(0);
    setLosungsInput("");
    setFeedbackNachricht("");
    // Puzzle wird neu geladen durch erneutes Ausführen des useEffects
    setIsLoading(true);
    setError(null);
  };

  // --- Funktion: Share-Text generieren ---
  const generateShareText = () => {
    const statusIcons = gerateneZutaten.map((z) => {
      switch (z.status) {
        case "grün": return "🟩";
        case "gelb": return "🟨";
        case "rot": return "🟥";
      }
    });

    return `🍲 Ingredio gelöst in ${versuche} Versuchen!\n\n${statusIcons.join("")}\n\n#ingredio`;
  };

  // --- Funktion: Share ---
  const handleShare = () => {
    const text = generateShareText();
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
      setFeedbackNachricht("Ergebnis kopiert!");
    }
  };

  // ============================================
  // RENDER: Ladebildschirm
  // ============================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-stone-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🍳</div>
          <p className="text-lg text-stone-600">
            Heutiges Gericht wird aus der Küche geholt...
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Fehlerbildschirm (kein Puzzle verfügbar)
  // ============================================
  if (error || !puzzle) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-orange-50 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Kein Rätsel verfügbar</h2>
          <p className="text-stone-600 mb-6">
            {error || "Für heute ist leider kein Rätsel in der Datenbank hinterlegt."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Gewonnen-Screen
  // ============================================
  if (spielStatus === "gewonnen") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-stone-800 mb-2">Gratulation!</h2>
          <p className="text-lg text-stone-600 mb-2">
            Du hast <span className="font-semibold text-emerald-600">{puzzle.dish_name}</span> erraten!
          </p>
          <p className="text-stone-500 mb-6">
            {versuche} {versuche === 1 ? "Versuch" : "Versuche"} benötigt
          </p>

          {/* Gericht-Info */}
          <div className="bg-amber-50 rounded-2xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              🌍 {puzzle.cuisine}
            </p>
          </div>

          {/* Eingabe-Zutaten */}
          <div className="mb-6">
            <p className="text-sm text-stone-500 mb-2">Deine Hinweise:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {gerateneZutaten.map((zutat, index) => (
                <span
                  key={index}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${FARBEN[zutat.status].bg} ${FARBEN[zutat.status].text}`}
                >
                  {zutat.name}
                </span>
              ))}
            </div>
          </div>

          {/* Share & Neues Spiel */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleShare}
              className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              Teilen
            </button>
            <button
              onClick={neuesSpiel}
              className="px-6 py-3 bg-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-300 transition-colors"
            >
              Neues Spiel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Verloren-Screen
  // ============================================
  if (spielStatus === "verloren") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-orange-50 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-3xl font-bold text-stone-800 mb-2">Leider daneben!</h2>
          <p className="text-lg text-stone-600 mb-4">
            Das Gericht war <span className="font-semibold text-emerald-600">{puzzle.dish_name}</span>
          </p>

          {/* Gericht-Info */}
          <div className="bg-amber-50 rounded-2xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              🌍 Küche: {puzzle.cuisine}
            </p>
          </div>

          {/* Neues Spiel */}
          <button
            onClick={neuesSpiel}
            className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            Nochmal spielen
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Hauptspiel
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-stone-100">
      {/* Header */}
      <header className="pt-8 pb-4 text-center">
        <h1 className="text-4xl font-bold text-stone-800 tracking-tight">
          🍲 Ingredio
        </h1>
        <p className="text-stone-500 mt-1">Errate das Gericht anhand seiner Zutaten</p>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pb-8">
        {/* Küchen-Info */}
        <div className="bg-white/60 backdrop-blur rounded-2xl p-4 mb-6 text-center shadow-sm">
          <p className="text-sm text-stone-600">
            Das gesuchte Gericht kommt aus der <span className="font-medium text-amber-700">{puzzle.cuisine}</span> Küche
          </p>
        </div>

        {/* Eingabe-Bereich */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <label className="block text-sm font-medium text-stone-600 mb-2">
            Zutat eingeben:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputWert}
              onChange={(e) => setInputWert(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="z.B. avocado, chili..."
              className="flex-1 px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:outline-none transition-colors"
            />
            <button
              onClick={handleZutatEingeben}
              className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors active:scale-95"
            >
              Eingeben
            </button>
          </div>

          {/* Feedback-Nachricht */}
          {feedbackNachricht && (
            <p className="mt-3 text-sm text-amber-600 animate-pulse">
              {feedbackNachricht}
            </p>
          )}
        </div>

        {/* Lösung-Button */}
        <button
          onClick={() => setLosungsModalOffen(true)}
          className="w-full py-4 bg-stone-800 text-white rounded-2xl font-semibold text-lg hover:bg-stone-900 transition-colors shadow-lg mb-6"
        >
          🍳 Gericht lösen
        </button>

        {/* Legende */}
        <div className="flex justify-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-500"></span>
            <span className="text-stone-600">Im Gericht</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-amber-400"></span>
            <span className="text-stone-600">Region</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-rose-400"></span>
            <span className="text-stone-600">Ohne Bezug</span>
          </div>
        </div>

        {/* Kochtopf (gesammelte Zutaten) */}
        <div className="bg-gradient-to-b from-stone-800 to-stone-900 rounded-3xl p-6 shadow-xl min-h-64">
          <div className="text-center mb-4">
            <span className="text-2xl">🍳</span>
            <h2 className="text-stone-300 text-sm font-medium mt-1">Dein Kochtopf</h2>
          </div>

          {gerateneZutaten.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-stone-500">
              <span className="text-4xl mb-2">🥄</span>
              <p className="text-sm">Hier erscheinen deine Zutaten...</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {gerateneZutaten.map((zutat, index) => (
                <div
                  key={index}
                  className={`
                    px-4 py-2 rounded-full font-medium text-sm
                    border-2 ${FARBEN[zutat.status].border}
                    ${FARBEN[zutat.status].bg} ${FARBEN[zutat.status].text}
                    transform transition-all duration-300
                    hover:scale-105 cursor-default
                  `}
                  title={FARBEN[zutat.status].label}
                >
                  {zutat.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Versuchs-Zähler */}
        <div className="mt-4 text-center text-stone-500 text-sm">
          {versuche} / {maxVersuche} Versuche
        </div>
      </main>

      {/* Lösung-Modal */}
      {losungsModalOffen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-stone-800 mb-2 text-center">
              Gericht erraten
            </h3>
            <p className="text-stone-500 text-center mb-6">
              Wie heißt das gesuchte Gericht?
            </p>

            <input
              type="text"
              value={losungsInput}
              onChange={(e) => setLosungsInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLösungAbgeben()}
              placeholder={`z.B. ${puzzle.dish_name}...`}
              className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:outline-none transition-colors mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLosungsModalOffen(false);
                  setLosungsInput("");
                }}
                className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-medium hover:bg-stone-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleLösungAbgeben}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
