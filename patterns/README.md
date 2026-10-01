Biblioteka układów graczy. Każdy plik JSON to jeden wzorzec: `name`, `source`, `era`, `tiles` (80 miejsc 4×4) i `layout` (budynki ze współrzędnymi na siatce 40×32). Skrypt `scripts/build-patterns.mjs` składa z nich `patterns.js`.

Można tu też wrzucić zapis miasta z „Zapisz projekt” (format `furia-city`), po jednym na plik.

Schematy graczy 1–8 pochodzą z ośmiu zrzutów ekranu Marka z 15.09.2026 (Pictures\Screenshots, 11:48–11:49), przepisanych automatycznie:

    python scripts/transcribe-map.py <zrzut.png> <katalog>/mN --labels patterns/labels/mN-labels.json

Kolor kafelka daje rodzaj budynku, obrys daje rozmiar, a nazwy warsztatów i budynków 4×4 (piec, fontanna, akademia) odczytano z arkusza etykiet i zapisano w `patterns/labels/`. Poziomy z obrazków nie są przenoszone. Nieznany budynek „Liceum” ze schematu 4 pominięto.
