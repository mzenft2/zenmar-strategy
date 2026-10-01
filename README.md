# Zenmar Strategy — generator głównego miasta HoH

**Autor: Marek „Zenmar”** ([github.com/mzenft2](https://github.com/mzenft2)) · © 2026 · licencja [GNU AGPL v3](LICENSE) z obowiązkiem zachowania autorstwa — szczegóły w [NOTICE.md](NOTICE.md).

## Otwieranie
Najprościej: kliknij dwukrotnie **Furia-generator.html**. To samodzielny plik — mapa, dane i obliczenia działają bez serwera i bez internetu. Nie wymaga UAC. Zamknięcie karty kończy pracę. Można przekazać sam plik HTML innemu graczowi.

## Wersja z serwerem (opcjonalna)
1. Otwórz folder projektu (ten, w którym leży ten plik).
2. Uruchom `Uruchom.ps1` przez PowerShell (prawy przycisk → Uruchom za pomocą programu PowerShell). Nie wymaga uprawnień administratora ani UAC.
3. Otwórz http://127.0.0.1:4173 w przeglądarce. Okno PowerShell zostaw otwarte.
4. Zaznacz teren, liczbę premium, budynki funkcyjne i rytm odbiorów. Kliknij „Ułóż miasto”.
5. Klikaj budynki po szczegóły. „Zapisz mapę SVG” pobiera obraz do odtworzenia miasta w grze.
6. Aby zakończyć, zamknij okno PowerShell. Aplikacja nie zmienia gry. Aby cofnąć ustawienia, zmień pola w kreatorze; są zapisane tylko w localStorage tej przeglądarki.

Alternatywnie `npm start` w katalogu aplikacji. Node.js jest już na tym komputerze.
Testy: `npm test`. Dane i ograniczenia: SOURCES.md. Licencja kodu: AGPL-3.0 (LICENSE, NOTICE.md).

Obecne wartości są w data.js. Generator nie wymaga żadnych pakietów z npm do działania.

Odtworzenie pojedynczego pliku: `node scripts/bundle.mjs`.

## Korzystanie z wersji 8.7
1. Po aktualizacji odśwież stronę (Ctrl+R). Wczytana mapa jest punktem startowym następnego szukania, jeśli spełnia aktualne wymagania.
2. Wskaż teren, potrzebne budynki funkcyjne i posiadane premium. Ratusz, piec i pięć koszar są zawsze obowiązkowe.
3. Podaj liczbę jubilerów, dmuchaczy szkła i alchemików. Przyciski „Po 2 każdego” i „Po 3 każdego” zmieniają tylko te trzy pola.
4. Podaj liczbę starych warsztatów w podstawowym celu; może wynosić zero. Opcjonalne porównanie osobno oblicza produkcję do limitu pieca.
5. Ustaw rytm zbiorów oraz parametry fontanny i poziom wieży. Wybierz silnik lub porównanie obu oraz 30 sekund, 1, 2, 5 albo 10 minut na całe szukanie (domyślnie 10 minut). Pełne szczęście koszar jest domyślnie wymagane.
6. Kliknij „Ułóż miasto” lub „Szukaj dalej”. Wybierz wariant nad mapą; tabela silników pokazuje również wolne kratki, czas i szczęście koszar. Porównaj ilości zasobów i ich łączną wartość w jedzeniu. Klikaj obiekty po szczegóły i zasięg.

Domyślne kursy porównawcze pochodzą z zestawienia Furii i są edytowalne. Przepalone towary nie są dodawane do wyniku ponownie obok iskier. Złoto jest pokazywane jako potencjalna wymiana; wyzerowanie iskier za złoto wyłącza jego wycenę.

Generator wyznacza miejsca, obroty i dobór farm/domów/szczęścia. Nie korzysta ze współrzędnych map Zenmara. Opis obliczeń i analizy map: OPTIMIZATION.md. Nie ma gwarancji optimum ani zapełnienia wszystkich kratek. Nieudane szukanie nie dowodzi, że miasto jest niemożliwe.

## Zapis i przywracanie
„Zapisz projekt” pobiera furia-miasto.json z wybranym wariantem oraz ustawieniami. Jeśli zmienisz ustawienia przed przeliczeniem, zapis zawiera same ustawienia. „Wczytaj projekt” przywraca plik i przelicza produkcję z katalogu; błędny plik nie zastępuje miasta. Wybrany wariant jest również zapisywany lokalnie i wraca po odświeżeniu strony. „Zapisz mapę SVG” pobiera sam obraz.

Aby cofnąć zmianę, wczytaj wcześniej zapisany projekt. Zamknięcie karty kończy obliczenia. Aplikacja nie wymaga UAC i nie zmienia miasta w grze.

## Ręczna edycja
1. Otwórz Furia-generator.html i odśwież stronę przez Ctrl+R. W nagłówku powinna być wersja 8.7.
2. Przy gotowym lub wczytanym układzie kliknij „Edytuj budynki”.
3. Przeciągnij budynek myszą lub wybierz go, wpisz kolumnę i wiersz, a potem kliknij „Przenieś budynek”. Współrzędne oznaczają lewy górny róg i zaczynają się od 1. Klawiatura: strzałki przesuwają, R obraca zaznaczony obiekt.
4. Obiekty o identycznych wymiarach można zamienić miejscami. Przy zapełnionej mapie użyj „Odłóż na bok”, przesuń sąsiadów, wybierz odłożony budynek i ustaw go we wskazanym miejscu. Nie działa on w czasie odłożenia.
5. „Cofnij” i „Ponów” obsługują historię ruchów w tej edycji. „Anuluj edycję” przywraca cały początkowy układ.
6. Po ustawieniu wszystkich odłożonych budynków kliknij „Zastosuj zmiany”. Mapa zapisze się lokalnie. „Zapisz projekt” pozwala pobrać również plik JSON. Edycja nie wymaga administratora i nie zmienia gry.

Ręczne ustawienie może mieć niedobór szczęścia koszar albo produkcji do pieca, z jawnym ostrzeżeniem. Generator nadal przestrzega zaznaczonych wymagań. „Szukaj dalej” rozpoczyna od ręcznego ustawienia, jeśli spełnia ono aktualne wymagania, i szuka poprawy. Niezastosowane ruchy nie zastępują ostatniego zapisu.

Znak „!” na budynku oznacza nadmiar szczęścia. Podpowiedź i szczegóły pokazują pełną otrzymaną sumę, próg do 200% oraz nadwyżkę. Nadwyżka nie zwiększa produkcji.


W wersji 8.7 przycisk „Szukaj dalej” uruchamia również wspólną przebudowę dzielnic. Najpierw zapisz projekt, jeśli chcesz zachować poprzednią mapę; możesz wrócić do niej przez „Wczytaj projekt”. Po Ctrl+R nagłówek powinien pokazywać 8.7. Obliczenia nie wymagają UAC. Edytor i zapis działają jak wcześniej.


W wersji 8.7 obok wyniku zobaczysz ocenę rozmieszczenia: puste kratki, pary sąsiadujących kultur i źródła szczęścia na granicy. „Układ roboczy” oznacza, że co najmniej jeden warunek nie jest jeszcze spełniony. Zapisz dotychczasową mapę, naciśnij Ctrl+R, sprawdź wersję 8.7 i wybierz „Szukaj dalej”. Zapisany projekt można później przywrócić przez „Wczytaj projekt”. Zapis i ręczne poprawianie układu roboczego są nadal możliwe.


## Długie szukanie i ocena wyniku w 8.7
„Szukaj dalej” zachowuje najlepszy znaleziony układ jako punkt wyjścia. Silnik przebudowuje dzielnice, zmienia dobór farm i mieszkań, a także próbuje nowych konstrukcji. Dziesięć minut jest budżetem całego uruchomienia, dzielonym między wybrane warianty i silniki.

W trakcie pracy mapa i zapis lokalny są okresowo aktualizowane. „Zatrzymaj i zachowaj wynik” kończy obliczenia z ostatnim otrzymanym wynikiem; kolejny start może go dalej poprawiać. Po zamknięciu karty lub odświeżeniu wraca ostatni zapis, nie niezapisane jeszcze ruchy silnika. Przed szukaniem pobierz „Zapisz projekt”, jeśli chcesz mieć możliwość powrotu do wcześniejszej mapy.

Pod mapą podajemy optymistyczny pułap produkcji i procentowy odstęp od niego. Pułap uwzględnia miejsce, pracowników, wymagane obiekty i rytm odbiorów, ale zakłada darmowe pełne szczęście bez miejsca na zwykłe kultury oraz pomija geometrię. Może być nieosiągalny. Odstęp nie jest obietnicą, o ile da się poprawić mapę; brak dziur ani długi czas szukania nie dowodzą optimum.


## Fragmenty i koszary oblężnicze w 8.7
Podczas przebudowy silnik próbuje również całych grup: rzędów farm i warsztatów z pasem domów oraz kwadratowych źródeł pomiędzy nimi, a także koszar po obu stronach wspólnego zasilania. Rozmiary wynikają z katalogu; propozycje są obracane i odbijane. Pod mapą jest licznik prób, poprawnych propozycji przeliczonych z otoczeniem i lokalnych popraw. Licznik nie oznacza, że wszystkie te fragmenty pozostały w końcowym mieście. Brak przyjęcia oznacza, że nie wygrały z dotychczasowym wynikiem i warunkami rozmieszczenia.

Po Ctrl+R sprawdź nagłówek 8.7 i kliknij „Szukaj dalej”. W „Minimum szczęścia oblężniczych” można podać 90–100%. Domyślnie i w starszym zapisie pozostaje 100%, dopóki gracz nie wybierze niższego progu. Przy włączonym wymaganiu szczęścia pozostałe cztery koszary nadal wymagają 100%; nadmiar jednych koszar nie kompensuje niedoboru innych. Pod mapą podajemy faktyczny poziom oblężniczych i wybrane minimum. Zapis projektu przechowuje ten próg. Nie wymaga UAC; do poprzedniej mapy wrócisz przez „Wczytaj projekt”.

## Wersja 8.8: całe pasy i uczciwe porównanie
Silnik przebudowuje również obszary na całą szerokość lub wysokość miasta. Długość proponowanych pasów dopasowuje do wolnego prostokąta, sprawdza obie osie i zmienia liczbę farm oraz domów. Wymagane warsztaty, administracja, koszary i premium pozostają zachowane. Przy wczytaniu miasta najpierw próbuje zamian kultury z domami i dokładnego przełożenia małych bloków, zanim przejdzie do dużej przebudowy.

Pod wynikami „Efekt tego szukania” porównuje produkcję, kulturę, farmy, domy i wolne kratki z początkiem bieżącego przebiegu. Wczytana mapa jest przeliczana przy aktualnych ustawieniach. Jeśli nie spełniała wymagań, tabela mówi o tym wprost. Towary w tej tabeli są ilością przed przepaleniem, a łączna wartość nadal nie liczy przepalonych towarów drugi raz. Historia porównania dotyczy uruchomienia; zapis JSON nadal zachowuje mapę i ustawienia, nie historię tabeli.

Po Ctrl+R sprawdź 8.8, pobierz „Zapisz projekt” jako punkt powrotu i kliknij „Szukaj dalej”. Nowe wyniki można zatrzymać dotychczasowym przyciskiem. UAC nie jest potrzebne. Cofnięcie układu: „Wczytaj projekt” i wcześniejszy JSON.

`references/zenmar-normalized.json` to ręcznie odtworzona geometria ze screena Marka: 1056 kratek, 25 farm, 5 kamieniarzy i po 2 bieżące warsztaty. Odtworzenie: `node scripts/zenmar-reference.mjs`. Poziomy ze screena zastępuje katalog wczesnej epoki, fontanna ma jawne parametry 5000 punktów / zasięg 3 z wcześniejszego przykładu. To nie eksport faktycznych parametrów konta. Mapę można wczytać zwykłym przyciskiem. Ma 99 kratek kultury i dodatkowe 20 fontanny oraz wieży. Przy domyślnym minimum 100% brakuje szczęścia oblężniczym, a jedna cienka kultura dotyka granicy; oryginał jest oznaczony jako ręczny i nie jest po cichu poprawiany. Silnik nie używa jej jako obowiązkowego szablonu.

## Wersja 8.19: języki i wsparcie

Interfejs ma polski, angielski, niemiecki, francuski, hiszpański, chiński uproszczony, koreański i wietnamski. Przy pierwszym otwarciu wybiera pierwszy obsługiwany język z `navigator.languages`; w pozostałych przypadkach angielski. Ręczny wybór w nagłówku ma pierwszeństwo i zapisuje się na tym urządzeniu. Zmiana języka nie przeładowuje strony ani nie przerywa szukania. Ustawienia, katalog i zapis JSON zachowują identyfikatory niezależne od języka. Opisy eksportowanej mapy SVG używają wybranego języka. Techniczne dokumenty źródłowe i licencja pozostają w oryginalnych językach.

Aby zmienić język, otwórz generator i wybierz język z listy w nagłówku. Możesz w każdej chwili wrócić do poprzedniego. Nie wymaga to instalacji ani uprawnień administratora.

„Wesprzyj rozwój” w prawym górnym rogu otwiera panel z formularzem Ko-fi profilu `zenmar`. Połączenie z Ko-fi następuje dopiero po otwarciu panelu. Zamknięcie: przycisk × albo Escape, gdy fokus jest w naszej części panelu. Nad formularzem jest link do Ko-fi w nowej karcie, również gdy osadzenie blokuje przeglądarka lub zabezpieczenie operatora. Język formularza i płatności zależą od Ko-fi. Test automatyczny otrzymał 403 Cloudflare; nie zweryfikowano rzeczywistej płatności i żadnej nie wykonano.

### Utrzymanie tłumaczeń

`translations.js` zawiera osiem kolumn w kolejności pl/en/de/fr/es/zh/ko/vi. `i18n.js` tłumaczy warstwę prezentacji istniejącego interfejsu, zachowuje źródła węzłów do odwracalnej zmiany języka i obsługuje dynamiczne komunikaty. Pełne zdania mają pierwszeństwo przed krótszymi fragmentami. Nowe komunikaty należy dopisać w całości, z kompletem ośmiu kolumn. Nie tłumaczyć obiektów silnika ani zapisanych map; nazwy budynków są tłumaczeniami opisowymi, bez deklaracji zgodności z oficjalną lokalizacją gry.

Weryfikacja w PowerShell z katalogu projektu:

1. `node scripts/bundle.mjs` odświeża samodzielny plik HTML.
2. `node server.mjs` uruchamia lokalny podgląd (zatrzymanie: Ctrl+C).
3. W drugim terminalu `node tests/browser/i18n.cjs` sprawdza osiem języków, zachowanie mapy/edycji/wyszukiwania, SVG, mały ekran i niedostępność zapisu przeglądarki. Wymaga zainstalowanego Chrome; alternatywną ścieżkę można podać przez zmienną ZENMAR_CHROME. Nie wymaga UAC, nie wykonuje wpłat.
