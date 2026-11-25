#!/bin/bash
# ============================================================
#  OLA AI — Lokalny chatbot na macOS (Intel, 8GB RAM)
#  Uruchomienie: chmod +x start_ola.sh && ./start_ola.sh
# ============================================================

set -e  # Zatrzymaj przy błędzie

echo ""
echo "🚀 Rozpoczynam proces ożywiania Oli na macOS..."
echo ""

# ─── 1. Sprawdzenie Homebrew ─────────────────────────────────
if ! command -v brew &> /dev/null; then
    echo "💡 Brak Homebrew — instaluję Xcode Command Line Tools..."
    xcode-select --install
    echo "⚠️  Po zakończeniu instalacji Xcode uruchom skrypt ponownie."
    exit 0
fi

# ─── 2. Sprawdzenie Pythona ──────────────────────────────────
if ! command -v python3 &> /dev/null; then
    echo "💡 Brak Python3 — instaluję przez Homebrew..."
    brew install python3
fi

# ─── 3. Tworzenie folderu projektu ──────────────────────────
PROJECT_DIR="$HOME/OlaAI"
echo "📁 Tworzę folder projektu: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# ─── 4. Wirtualne środowisko Python ─────────────────────────
if [ ! -d "venv" ]; then
    echo "🐍 Tworzę wirtualne środowisko Python..."
    python3 -m venv venv
fi

echo "🔄 Aktywuję środowisko..."
source venv/bin/activate

# ─── 5. Instalacja bibliotek ─────────────────────────────────
echo ""
echo "📦 Instaluję biblioteki (llama-cpp-python + huggingface_hub)..."
echo "   ⏳ To może potrwać kilka minut przy pierwszym uruchomieniu..."
echo ""

pip install --upgrade pip --quiet

# Optymalizacja pod Intel (bez Metal GPU)
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS -DGGML_NATIVE=ON" \
    pip install llama-cpp-python huggingface_hub --quiet

echo "✅ Biblioteki zainstalowane."

# ─── 6. Pobieranie modelu ────────────────────────────────────
MODEL_FILE="$PROJECT_DIR/model.gguf"

if [ ! -f "$MODEL_FILE" ]; then
    echo ""
    echo "📥 Pobieram nowy model Phi-3.5-mini-instruct (~2.4 GB)..."
    echo "   ⏳ Czas pobierania zależy od łącza (może być 5–15 min)..."
    echo ""

    python3 -c "
from huggingface_hub import hf_hub_download
import shutil, os

path = hf_hub_download(
    repo_id='bartowski/Phi-3.5-mini-instruct-GGUF',
    filename='Phi-3.5-mini-instruct-Q4_K_M.gguf',
    local_dir='.'
)
dest = os.path.join(os.path.dirname(path), '..', 'model.gguf') if 'blobs' in path else 'model.gguf'
shutil.copy(path, '$MODEL_FILE')
print('✅ Nowy model pobrany!')
"
else
    echo "✅ Model już istnieje — pomijam pobieranie."
fi

# ─── 7. Tworzenie skryptu ola.py ────────────────────────────
cat > "$PROJECT_DIR/ola.py" << 'PYEOF'
#!/usr/bin/env python3
# ============================================================
#  OLA — Lokalny chatbot (Phi-3.5-mini, llama-cpp-python)
# ============================================================
import os
import sys

try:
    from llama_cpp import Llama
except ImportError:
    print("❌ Brak llama_cpp. Uruchom ponownie start_ola.sh")
    sys.exit(1)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.gguf")

if not os.path.exists(MODEL_PATH):
    print(f"❌ Brak modelu: {MODEL_PATH}")
    print("   Uruchom ponownie start_ola.sh aby pobrać model.")
    sys.exit(1)

print("\n🔄 Ładuję model (chwilę poczekaj)...")

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_threads=4,      # Dostosuj do liczby rdzeni CPU
    n_batch=512,
    verbose=False
)

SYSTEM_PROMPT = (
    "Jesteś Ola — pomocna, przyjazna asystentka AI. "
    "Odpowiadasz po polsku, krótko i konkretnie."
)

historia = []

print("\n" + "="*50)
print("🌟  OLA JEST ŻYWA!")
print("    Napisz wiadomość lub wpisz 'exit' aby zakończyć.")
print("    Wpisz 'reset' aby wyczyścić historię rozmowy.")
print("="*50)

while True:
    try:
        user_input = input("\n👤 Ty: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\n\n👋 Do zobaczenia!")
        break

    if not user_input:
        continue

    if user_input.lower() in ["exit", "quit", "koniec"]:
        print("\n👋 Do zobaczenia!")
        break

    if user_input.lower() == "reset":
        historia = []
        print("🔄 Historia wyczyszczona.")
        continue

    # Buduj prompt z historią
    historia.append(f"<|user|>\n{user_input}<|end|>")
    full_prompt = f"<|system|>\n{SYSTEM_PROMPT}<|end|>\n" + "\n".join(historia) + "\n<|assistant|>"

    print("💭 Ola myśli...", end="\r", flush=True)

    try:
        res = llm(
            full_prompt,
            max_tokens=300,
            stop=["<|end|>", "<|user|>"],
            echo=False
        )
        answer = res["choices"][0]["text"].strip()
        historia.append(f"<|assistant|>\n{answer}<|end|>")

        # Ogranicz historię do ostatnich 10 wymian
        if len(historia) > 20:
            historia = historia[-20:]

        print(f"🌟 Ola: {answer}")

    except Exception as e:
        print(f"❌ Błąd: {e}")

PYEOF

chmod +x "$PROJECT_DIR/ola.py"

# ─── 8. Skrót do uruchamiania ────────────────────────────────
cat > "$PROJECT_DIR/uruchom_ole.sh" << 'RUNEOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python3 ola.py
RUNEOF

chmod +x "$PROJECT_DIR/uruchom_ole.sh"

# ─── 9. Start! ───────────────────────────────────────────────
echo ""
echo "✅ Instalacja zakończona!"
echo ""
echo "📌 Następnym razem możesz uruchomić Olę bezpośrednio:"
echo "   cd ~/OlaAI && ./uruchom_ole.sh"
echo ""
echo "─────────────────────────────────────────────"
python3 "$PROJECT_DIR/ola.py"
