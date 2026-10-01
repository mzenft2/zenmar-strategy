# Źródła i obliczenia — 14.09.2026

## Katalog epok i fontanny — aktualizacja 15.09.2026

Źródło: https://forgeofgames.com/api/hoh/coreData, wersja 2026-09-08_08-13-17. Katalog pobiera scripts/fetch-data.cjs, schemat publicznego API odczytuje scripts/read-fog.cjs (Models.Hoh z Forge of Games), a scripts/build-data.cjs wybiera najwyższe poziomy dostępne do danej epoki. Odcisk źródła jest w data.js. Odtworzenie: node scripts/fetch-data.cjs, następnie node scripts/build-data.cjs.

Obsługiwane są wszystkie 14 epok od kamienia do późnego gotyku. Warsztaty na rozwój pochodzą z wybranej epoki. Starszy kamieniarz do wariantu pieca jest dostępny od Bizancjum; wcześniej nie przypisujemy bieżących towarów do starszej grupy. Budynki opcjonalne i wymagane koszary muszą być dostępne w epoce.

Fontanna: wybór poziomu 1–50, punkty według epoki miasta i poziomu, zasięg według poziomu. Poziom 50 zachowuje ostatnią wartość punktów (49), zgodnie z CultureComponent.GetValue w źródle, z zasięgiem 6. Przykład: poziom 32, wczesny gotyk: 1980 punktów, zasięg 4; późny gotyk: 2150 punktów, zasięg 4. Starsze zapisy z ręcznymi wartościami pozostają odczytywane bez ich cichej zamiany. Nowe szukanie korzysta z katalogu.

Kursy wartości i wymiany pozostają ustawieniami gracza, z historycznymi domyślnymi wartościami dla gotyku. Nie są tabelą kursów dla wszystkich epok. Przed odblokowaniem pieca limity wymiany wynoszą zero.

## Pierwotny katalog (zastąpiony powyższym źródłem)
https://heroesofhistory.wiki/capital-city#buildings
Publiczny katalog BuildingDefinitionDTO w zasobach strony. Zachowano sourceId każdego budynku w data.js. Wybrano maksymalny poziom grupy w gotyku; starsze warsztaty zachowano na najwyższym dostępnym poziomie ich grupy. Szkoła i liceum mają własną ścieżkę poziomów i są liczone na maksimum katalogu. Wieża minojska jest liczona na poziomie wskazanym przez gracza: katalog zawiera poziomy 1–10, ich punkty szczęścia, zasięg i pracowników (na każdym z tych poziomów zasięg to 3). Zapisano sourceId osobno dla każdego poziomu. Dawne ustawienie wieży bez poziomu wymaga wybrania go, zachowując resztę ustawień miasta.

Katalog pozyskano z 2780-518861e765e96455.js (moduł 7721), uzupełnienie kolekcjonerskie z page-ddffcacae060ce14.js. Skrypt scripts/build-data.cjs normalizuje zapisane dane. Surowe pliki są lokalnie w research, odcisk SHA-256 w data.js. Zaktualizowany katalog może wymagać nowego pobrania — aplikacja nie udaje bieżącej synchronizacji.

## Szczęście
Adaptacja otwartego kodu https://github.com/ingweland/forge-of-games, commit 17bf906e3b91ada869eefcec708bc62887b40014, na AGPL-3.0. Zasięg to prostokąt rozszerzony o podaną liczbę kratek w każdą stronę. Wystarczy dodatnia powierzchnia przecięcia z budynkiem; samo zetknięcie krawędzi prostokątów nie wystarcza. Punkty kilku źródeł sumują się, każde oddziałuje na wszystkich odbiorców w zasięgu. Bonus godzinowy = podłoga(min(punkty, zapotrzebowanie) × współczynnik zasobu), dodawany do produkcji bazowej. Zgodnie z doprecyzowaniem Marka (14.09.2026) produkcja ma dodatkowy twardy limit 200% bazowej; zapobiega to także minimalnemu przekroczeniu ×2 przez zaokrąglone współczynniki katalogu. Nadmiar szczęścia jest pokazywany oddzielnie i nie daje dalszej produkcji.

## Odbiory
Co podaną liczbę godzin podczas dnia, dodatkowo odbiór przed snem i po nocy. Każda przerwa daje produkcję za min(przerwa, pojemność czasowa magazynu). Domyślne 3 h w dzień i 8 h snu są ustawieniami do zmiany, nie odczytem konta. Abonament podwaja okno magazynowania, nie godzinową produkcję.

## Kursy i wartość porównawcza
Źródło: lokalne zestawienie Marka „Produkcja Furii”, stan 2.09.2026 (treść w Produkcja Furii_files/_t.html). Nie jest aktualnym odczytem konta gry.
- Gotyk: 1 towar = 181 jedzenia w punktacji raportu, jako porównanie produkcji na zajętym miejscu.
- 70 towarów → 95 iskier; dzienny limit 7000 towarów.
- 84 000 złota → 170 iskier; limit złota 8,4 mln / dobę.
- Wartość iskry: 181 × 70 / 95; zapis początkowy zaokrąglony do sześciu miejsc po przecinku.

Wszystkie kursy i limity są edytowalne. Liczymy pełne paczki z dziennego zbioru, bez dawnych zapasów. Towary zużyte na iskry nie są jednocześnie liczone jako towary. Złoto prezentujemy osobno jako potencjalne iskry. Bez embers z pieca i dodatkowych nagród fontanny. Wartość w jedzeniu nie jest rzeczywistą wymianą zasobów w grze.

## Zakres i ograniczenia
- Stolica: 10 × 8 miejsc po 4 × 4 kratki. Katalog 14 epok od kamienia do późnego gotyku.
- Ratusz, piec i koszary są obowiązkowe od epoki, w której są dostępne. Szkoła, liceum, akademia i wieża są wybierane przez użytkownika. Zachowujemy podane ilości premium.
- Cele warsztatów to konkretne liczby każdego typu. Generator nie narzuca starych warsztatów w podstawowym wariancie. Wariant dodatkowy szacuje ich liczbę i sprawdza rzeczywisty zbiór względem limitu pieca.
- Stare warsztaty: kamieniarz, najwyższy poziom grupy 5, 3 pracowników, do 60 towarów/h. Poziom minojski 2 z mapy Marka ma tę samą produkcję, potrzebę szczęścia i pracowników. Bieżące warsztaty wymagają 5 pracowników.
- Pięć pełnych starych warsztatów daje nominalnie 7200/dobę, ale przy odbiorze co 3 h i 8 h nocy magazyn 4 h ogranicza zbiór do 6000. Abonament podwaja magazyn. Alternatywne receptury nocne nie są potwierdzone w katalogu i nie są symulowane.
- Fontanna: 4 × 4; gracz wybiera poziom, a punkty i zasięg pochodzą z katalogu. Wieża ma dane poziomów w katalogu. Wyszukiwanie porównuje domy wewnątrz zasięgu i duże budynki przy jego skraju. Nie wymaga zachowania liczby domów przy fontannie; liczy wszystkich odbiorców i wartość całego miasta.
- Produkcja jest ograniczona do 200%. Nadmiar jednego odbiorcy może wynikać z obsługi drugiego tym samym źródłem i nie daje dalszego bonusu.
- Pełne szczęście wszystkich koszar jest opcjonalnym warunkiem, który nie jest automatycznie łagodzony. Bez tego warunku pokazujemy rzeczywisty poziom szczęścia.
- Wyszukiwanie ma ograniczoną liczbę prób, bez zapisanych szablonów miast. Może zostawić wolne pola lub nie znaleźć istniejącego rozwiązania. Szczegółowy model, analiza map i ograniczenia są w OPTIMIZATION.md.
- Źródło obliczeń szczęścia: Forge of Games (NOTICE.md). OR-Tools i MaxRects były rozważane, ale nie są używane; nie deklarujemy matematycznego dowodu optimum.
- Nie uwzględniamy kosztów budowy, ulepszeń, bieżących kosztów produkcji warsztatów, czasowych bonusów, nagród budynków funkcyjnych ani harmonogramu przebudowy. Złoto i zasoby są produkcją brutto; potencjalne przepalanie złota może ograniczać środki na budowę.
- Mapa referencyjna Marka ma mieszane poziomy i późny gotyk. Wynik katalogowy nie jest odczytem tego konta ani bezpośrednim porównaniem wydajności identycznych miast.

## Pliki projektu
Zapis przechowuje ustawienia, identyfikatory i współrzędne wybranego wariantu. Wczytanie sprawdza teren, wymiary, kolizje, wymagane obiekty, pracowników i cele. Parametry budynków zawsze pochodzą z katalogu; dopisane do zapisu statystyki nie są traktowane jako dane gry. Stare poprawne zapisy można oglądać; nowe obliczenia uruchamia przycisk „Odśwież wynik”.
