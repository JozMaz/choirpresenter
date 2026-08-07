import type { Dict } from "./en";

export const pl: Dict = {
  common: {
    cancel: "Anuluj",
    save: "Zapisz",
    saving: "Zapisywanie...",
    delete: "Usuń",
    confirm: "Potwierdź",
    clear: "Wyczyść",
    copy: "Kopiuj",
    copied: "Skopiowano",
    loading: "Wczytywanie...",
    noResults: "Brak wyników",
    results: (count, more) => `Wyniki: ${count}${more ? "+" : ""}`,
    showingFirst: (count) => `(pokazano pierwsze wyniki: ${count})`,
    clearSearch: "Wyczyść wyszukiwanie (Esc)",
    settings: "Ustawienia",
    songs: "Pieśni",
    bibles: "Biblie",
    bible: "Biblia",
    messages: "Kazania",
    sermons: "Kazania",
    sermonsLower: "kazania",
    songbooks: "Śpiewniki",
    mySongs: "Moje pieśni",
  },

  sectionTypes: {
    verse: "Zwrotka",
    chorus: "Refren",
    bridge: "Przejście",
    ending: "Zakończenie",
  },

  displayGroups: {
    songs: "Pieśni",
    bible: "Biblia",
    messages: "Kazania",
  },

  outputModes: {
    fullscreen: "Pełny ekran",
    lowerThirds: "Pasek dolny",
  },

  boot: {
    connecting: "Łączenie...",
    checkingForData: "Sprawdzanie danych...",
    downloadingData: (file) => `Pobieranie danych — ${file}`,
    cannotLoadData: "Nie można wczytać danych",
    connectAndRestart:
      "Połącz się z internetem i uruchom aplikację ponownie.",
    bootstrapFailed: "Nie udało się pobrać danych.",
    noCloudNoCache:
      "Chmura jest niedostępna, a na dysku nie ma kopii danych. Połącz się z internetem i uruchom aplikację ponownie.",
    tokenExpired:
      "Token stracił ważność. Poproś administratora o nowy.",
    localDataMode: "Tryb danych lokalnych",
  },

  offers: {
    newContentAvailable: "Nowe materiały do pobrania:",
    download: "Pobierz",
    notNow: "Nie teraz",
  },

  preview: {
    toggleVisibility: (name) => `Pokaż lub ukryj podgląd wyjścia „${name}”`,
  },

  saveStatus: {
    savingToCloud: "Zapisywanie w chmurze...",
    savingShort: "Zapisywanie…",
    syncedToCloud: "Zapisano w chmurze",
    saved: "Zapisano",
    localOnlyHint:
      "Brak tokenu zapisu — zapisano tylko na tym urządzeniu. Token dodasz w Ustawieniach.",
    localOnly: "Tylko lokalnie",
    cloudFailedHint:
      "Zapis w chmurze nie powiódł się — sprawdź internet albo swój token zapisu",
    cloudFailed: "Błąd chmury",
  },

  songSave: {
    publishedAdminOnly:
      "Opublikowane śpiewniki może zmieniać tylko administrator.",
    cannotMoveOutOfPublished:
      "Nie można przenieść pieśni z opublikowanego śpiewnika — może to zrobić tylko administrator.",
    copiedButRemoveFailed:
      "Skopiowano do Moich pieśni, ale nie udało się usunąć ze starego śpiewnika — pieśń jest teraz w obu.",
    movedToMySongs: "Przeniesiono do Moich pieśni",
    movedLocallyCloudFailed:
      "Przeniesiono na tym urządzeniu, ale zapis w chmurze nie powiódł się — inni nadal widzą pieśń w starym śpiewniku.",
    movedToMySongsLocal:
      "Przeniesiono do Moich pieśni (tylko na tym urządzeniu)",
    saveFailed: "Zapis nie powiódł się — nic nie zostało zmienione.",
    saveRefused:
      "Zapis został odrzucony — nic nie zostało zmienione. Sprawdź dane i spróbuj ponownie.",
    movedTo: (book) => `Przeniesiono do: ${book}`,
    movedToCloudFailed: (book) =>
      `Przeniesiono do: ${book} na tym urządzeniu, ale zapis w chmurze nie powiódł się.`,
    movedToLocalOnly: (book) =>
      `Przeniesiono do: ${book} (tylko na tym urządzeniu)`,
    addedButRemoveFailed: (book) =>
      `Dodano do: ${book}, ale nie udało się usunąć ze starego śpiewnika — pieśń jest teraz w obu.`,
    savedLocallyCloudFailed:
      "Zapisano na tym urządzeniu, ale zapis w chmurze nie powiódł się.",
    deleteFailed: "Nie udało się usunąć — pieśń pozostała.",
    songDeleted: "Pieśń usunięta",
    deletedLocallyCloudFailed:
      "Usunięto na tym urządzeniu, ale zapis w chmurze nie powiódł się.",
    deletedThisDeviceOnly: "Usunięto tylko na tym urządzeniu",
  },

  actionBar: {
    removeFromSelected: "Usuń z listy wybranych",
    addToSelected: "Dodaj do listy wybranych",
    editCurrentSong: "Edytuj otwartą pieśń",
    addNewSong: "Dodaj nową pieśń",
    previousPart: "Poprzednia część (↑)",
    nextPart: "Następna część (↓/spacja)",
    showText: "Pokaż tekst (X)",
    hideText: "Ukryj tekst (X)",
  },

  selectionHeader: {
    fallbackTitle: "Fragmenty",
    restore: "Przywróć to, co przed chwilą zamknięto",
    nothingToRestore: "Nie ma czego przywracać",
    unselectHint: "Zamknij — czyści tę listę i oba wyjścia",
    nothingSelected: "Nic nie jest otwarte",
    unselect: "Zamknij",
  },

  selectedPanel: {
    confirmClearTitle: "Wyczyścić listę wybranych?",
    confirmClearMessage: (count) =>
      `Z listy zniknie wszystkich pozycji: ${count}. Nic nie zostanie usunięte ze śpiewników, Biblii ani kazań.`,
    clearAll: "Wyczyść",
    clearAllHint: "Wyczyść całą listę wybranych",
    mySongsCount: (count) => `Moje pieśni (${count})`,
    selectedCount: (count) => `Wybrane (${count})`,
    reorderHint: "Przeciągnij pozycję, aby zmienić kolejność",
    openOrGoLive:
      "Kliknij, aby otworzyć; kliknij dwukrotnie, aby wyświetlić na żywo",
    removeFromSelection: "Usuń z listy wybranych",
    empty: "Nic jeszcze nie wybrano",
  },

  songRow: {
    editSong: "Edytuj pieśń",
    alreadySelected: "Już na liście wybranych",
    addToSelection: "Dodaj do wybranych",
  },

  songbooksTree: {
    searchPlaceholder: "Szukaj we wszystkich śpiewnikach...",
    noSongbooks:
      "Nie pobrano żadnego śpiewnika — wybierz je w Ustawieniach.",
    resultsCount: (count) => `Wyniki: ${count}`,
  },

  bibleBrowser: {
    loading: "Wczytywanie Biblii...",
    failed: "Nie udało się wczytać Biblii",
    unavailable: (name) => `${name} (niepobrana)`,
    searchPlaceholder: "Szukaj wersetów...",
    loadOrGoLive:
      "Kliknij, aby otworzyć; kliknij dwukrotnie, aby wysłać na wyjścia",
  },

  messagesBrowser: {
    titlePlaceholder: "Tytuł lub rok...",
    clearTitleSearch: "Wyczyść wyszukiwanie tytułu (Esc)",
    fullTextPlaceholder: "Szukaj w treści kazań...",
    clearFullTextSearch: "Wyczyść wyszukiwanie w treści (Esc)",
    textNotAvailable: "Treść niedostępna",
    inMessages: (count) => ` w kazaniach: ${count}`,
    countOf: (shown, total) => `Kazania: ${shown} z ${total}`,
    count: (total) => `Kazania: ${total}`,
    noTitlesMatch: "Żaden tytuł nie pasuje",
    paragraphShort: "ak.",
    titleMatch: "tytuł",
    loadOrGoLive:
      "Kliknij, aby otworzyć; kliknij dwukrotnie, aby wysłać na wyjścia",
  },

  sectionsList: {
    pickSomething:
      "Wybierz pieśń, rozdział Biblii albo kazanie, aby zacząć.",
    findInMessage: "Znajdź w tym kazaniu...",
    clearEsc: "Wyczyść (Esc)",
    previousMatch: "Poprzednie trafienie (Shift+Enter)",
    nextMatch: "Następne trafienie (Enter)",
    jumpTop: "Przejdź na początek",
    alreadyTop: "Jesteś już na początku",
    jumpCurrent: "Przejdź do fragmentu, który jest na wyjściu",
    nothingLive: "Nic nie jest jeszcze wyświetlane",
    currentVisible: "Ten fragment jest już widoczny",
    jumpBottom: "Przejdź na koniec",
    alreadyBottom: "Jesteś już na końcu",
  },

  songChunks: {
    parts: (count) => `${count} części`,
  },

  monitorPicker: {
    stopToChange: "Wyłącz wyjście, aby zmienić monitor",
    choose: "Wybierz monitor",
    noOtherMonitor: "Nie wykryto drugiego monitora.",
    connectProjector: "Podłącz projektor albo drugi ekran.",
    start: "Włącz",
    stop: "Wyłącz",
  },

  exactSearch: {
    on: "Dokładna fraza: włączona — szuka wpisanych słów tylko obok siebie",
    off: "Dokładna fraza: wyłączona — szuka wszystkich słów w dowolnym miejscu",
  },

  outputPreview: {
    boxModePadding: "Wg tekstu",
    boxModePaddingHint:
      "Tło dopasowuje się do tekstu, z marginesem dookoła",
    boxModeFixed: "Stałe",
    boxModeFixedHint:
      "Tło ma zawsze ten sam rozmiar, niezależnie od ilości tekstu",
    left: "Lewo",
    centre: "Środek",
    right: "Prawo",
    top: "Góra",
    bottom: "Dół",
    fitOn:
      "Podgląd jest powiększony, żeby dało się go odczytać — na wyjściu nic się nie zmienia",
    fitOff: "Podgląd wygląda dokładnie tak jak wyjście",
    fit: "Powiększ",
    oneToOne: "1:1",
    openSettings: (name) => `Ustawienia wyjścia „${name}”`,
    netStart: "Uruchom",
    netStop: "Zatrzymaj",
    groupLive: (label) => `${label} — właśnie to jest na wyjściu`,
    fade: "Przenikanie",
    textSize: "Rozmiar tekstu",
    tightLabels: "Podpisy blisko tekstu",
    tightLabelsHint:
      "Trzyma odnośnik i nazwę tuż przy tekście, zamiast przy krawędziach kadru",
    scale: "Wielkość",
    anchorX: "Punkt X",
    anchorY: "Punkt Y",
    offsetX: "Lewo / prawo",
    offsetY: "Góra / dół",
    background: "Tło pod tekstem",
    ipOnlyTitle: "Tylko przez IP — HDMI nie przenosi przezroczystości",
    ipOnlyBody:
      "HDMI przesyła pełny obraz bez kanału alfa, więc tło nie może być półprzezroczyste — Twoje wideo nigdy by przez nie nie prześwitywało. Zamiast rysować pełną plamę, tło jest pomijane. Wielkość i położenie ustawione wyżej nadal działają. Przełącz to wyjście na IP, aby korzystać z tych ustawień.",
    ipOnlyLuma:
      "Kadr jest czarny — usuń go kluczem luma w programie do streamingu.",
    horizontal: "W poziomie",
    vertical: "W pionie",
    paddingX: "Margines X",
    paddingY: "Margines Y",
    width: "Szerokość",
    height: "Wysokość",
    radius: "Zaokrąglenie",
    darkness: "Przyciemnienie",
    softEdges: "Miękkie krawędzie",
    addressPlaceholder: "Uruchom, aby poznać adres",
    copyHint:
      "Kopiuj — wklej jako źródło przeglądarki w programie do streamingu",
    adapter: "Karta sieciowa:",
    couldNotStart: (error) => `Nie udało się uruchomić: ${error}`,
    noNetworkAddress:
      "Nie znaleziono adresu sieciowego — ten komputer nie jest w sieci lokalnej.",
    browserSourceHint:
      "Dodaj ten adres jako źródło przeglądarki w programie do streamingu. Oba komputery muszą być w tej samej sieci, a zapora musi przepuszczać połączenia przychodzące.",
    dragHint:
      "Przeciągnij, aby przesunąć — przyciąga do środka i do położenia domyślnego; kliknij dwukrotnie, aby zresetować",
  },

  settings: {
    title: "Ustawienia",
    admin: "Administracja",
    backToSettings: "Powrót do ustawień",

    confirmWipeTitle: "Usunąć pobrane dane?",
    confirmWipeMessage:
      "Śpiewniki, Biblie i kazania znikną z tego urządzenia, a aplikacja uruchomi się ponownie. Twoje własne pieśni i token pozostaną. To, co wybierzesz ponownie, pobierze się z chmury.",
    confirmWipeButton: "Usuń",
    confirmSignOutTitle: "Zapomnieć token?",
    confirmSignOutMessage:
      "Aplikacja uruchomi się ponownie i znów poprosi o token. Pobrane dane i Twoje własne pieśni zostaną na dysku.",
    confirmSignOutButton: "Zapomnij",

    outputs: "Wyjścia",
    outputsHint:
      "Naraz mogą działać dwa wyjścia. Każde idzie albo na ekran przez HDMI, albo pod adres internetowy przez IP, i pokazuje albo cały kadr, albo pasek dolny. Wielkość, położenie i przenikanie ustawiasz osobno dla Pieśni, Biblii i Kazań — w podglądzie po prawej.",
    keepOneOutputOn: "Przynajmniej jedno wyjście musi zostać włączone",
    turnOutputOff: "Wyłącz to wyjście",
    turnOutputOn: "Włącz to wyjście",
    on: "Wł.",
    off: "Wył.",
    sentBy: "Przez",
    shows: "Widok",
    hdmiHint: "Okno na drugim ekranie",
    ipHint:
      "Adres internetowy, który inne komputery otwierają jako źródło przeglądarki",
    fullscreenHint: "Wypełnia cały kadr — główna projekcja",
    lowerThirdsHint: "Pasek z tekstem — do nałożenia na obraz w streamingu",
    hdmiNoAlphaBefore: "Wielkość i położenie działają normalnie, ale ",
    hdmiNoAlphaBold: "HDMI nie przenosi przezroczystości",
    hdmiNoAlphaAfter:
      " — nie ma kanału alfa, więc tło pod tekstem nigdy nie przepuściłoby Twojego wideo. Suwaki tła zostają widoczne, ale wyszarzone, a tło nie jest rysowane. Przełącz na IP, aby z nich korzystać.",
    lowerThirdsNote:
      "Przezroczysta nakładka z przyciemnionym tłem pod tekstem. Wielkość i położenie ustawiasz osobno dla Pieśni / Biblii / Kazań w podglądzie.",
    fullscreenNote:
      "Wypełnia cały kadr. Rozmiar tekstu i przenikanie ustawiasz osobno dla Pieśni / Biblii / Kazań w podglądzie.",

    whatGoesOnOutputs: "Co trafia na każde wyjście",
    whatGoesOnOutputsHint:
      "Ile tekstu pokazuje każde wyjście i jakie podpisy wyświetla — osobno dla każdego śpiewnika. Całość = cała zwrotka naraz, Zapisany podział = podział zapisany razem z pieśnią, Maks. linii = równy podział na części po najwyżej tyle linii, najkrótsza część na początku.",
    groupWhole: "Całość",
    groupSaved: "Zapisany",
    groupMaxLines: "Maks. linii",
    copyToEverySongbook: "Skopiuj do wszystkich śpiewników",

    chromeSongHeader: "Nazwa fragmentu (lewy górny róg)",
    chromeSongFooter: "Podpis pieśni (na dole)",
    chromeBibleHeader: "Odnośnik",
    chromeBibleFooter: "Nazwa Biblii",
    chromeMessageHeader: "Tytuł na górze",
    chromeMessageFooter: "Tytuł na dole",
    chromeSequence: "Kolejność zwrotek (prawy górny róg)",
    chromeSecondary: "Drugi język",
    chromeSwapLabels: "Zamień górę z dołem",
    chromeSwapLabelsHint:
      "Nazwa Biblii trafia na górę, a odnośnik na dół",

    downloadedContent: "Pobrane materiały",
    nowDownloaded: (summary) =>
      `Pobrane: ${summary}. Tylko te materiały są aktualizowane.`,
    nothingDownloaded:
      "Nic jeszcze nie pobrano, więc biblioteka po lewej jest pusta.",
    chooseWhatToDownload: "Wybierz, co pobrać",
    deleteDownloadedData: "Usuń pobrane dane",

    access: "Dostęp",
    signedInAs: (name, isAdmin) =>
      `Zalogowano jako ${name}${
        isAdmin ? " (administrator)" : ""
      }. Token działa na dowolnej liczbie urządzeń.`,
    notSignedIn: "Nie zalogowano.",
    forgetToken: "Zapomnij token na tym urządzeniu",

    appearance: "Wygląd",
    themeDark: "Ciemny",
    themeLight: "Jasny",
    themeSystem: "Jak w systemie",
    language: "Język",

    songFooter: "Podpis pieśni na wyjściu pełnoekranowym",
    songFooterHint:
      "Które elementy podpisu pojawiają się pod tekstem pieśni — osobno dla każdego śpiewnika. Rozdziały Biblii i kazania mają własny podpis i to ustawienie ich nie dotyczy.",
    footerNumber: "Numer",
    footerTitle: "Tytuł",
    footerKey: "Tonacja",
    footerCell: (field, book) => `${field} — ${book}`,

    divider: "Linia między językami",
    dividerHint:
      "Grubość linii rozdzielającej oba języki oraz ramki wokół etykiety tłumaczenia. Dotyczy wszystkich wyjść.",

    translationLabel: "Etykieta tłumaczenia",
    translationLabelHint:
      "Napis w ramce na linii nad tłumaczeniem — osobno dla każdego śpiewnika. Zostaw puste, aby rozpoznać go z treści tłumaczenia. Pojedyncza pieśń może to zmienić w edytorze.",
    translationLabelAuto: (fallback) => `automatycznie (${fallback})`,

    backup: "Kopia zapasowa",
    backupHint:
      "Zapisz kopię danych do wybranego folderu (np. Pobrane albo Pulpit). Rób to od czasu do czasu, żeby nic nie przepadło.",
    exportAll: "Zapisz wszystko",
    exporting: "Zapisywanie…",
    exported: (files, path) =>
      `Zapisano plików: ${files} w folderze ${path}`,
    exportFailed: "Nie udało się zapisać kopii.",

    cloudData: "Dane w chmurze",
    localVersion: "Wersja na tym urządzeniu:",
    cloudVersion: "Wersja w chmurze:",
    updateAvailable:
      "W chmurze są nowsze dane. Kliknij poniżej, aby je pobrać.",
    updateNow: "Aktualizuj teraz",
    forceResyncHint:
      "Pobierz wybrane materiały jeszcze raz, pomijając sprawdzanie, co już jest na dysku",
    syncing: "Pobieranie…",
    forceResync: "Pobierz wszystko od nowa",
    dataUpdated: "Dane zaktualizowane.",
    syncFailed: "Pobieranie nie powiodło się",
    upToDate: "Wszystko aktualne",

    writeToken: "Token zapisu",
    writeTokenHint:
      "Token pozwalający zapisywać zmiany w pieśniach do wspólnej bazy w chmurze. Bez niego zmiany zostają tylko na tym urządzeniu. Token otrzymasz od administratora.",
    tokenSaved: "•••••••••• (zapisany)",
    tokenPlaceholder: "Wklej swój token",
    tokenSavedMsg: "Zapisano.",
    tokenSaveFailed: "Nie udało się zapisać.",
    tokenCleared: "Usunięto.",
    status: "Stan:",
    writeEnabled: "Zapis włączony — zmiany trafiają do chmury",
    readOnly: "Tylko do odczytu — zmiany zostają na tym urządzeniu",

    about:
      "— aplikacja do wyświetlania pieśni, wersetów biblijnych i kazań. Dwa niezależne wyjścia, każde jako projekcja pełnoekranowa albo pasek dolny do streamingu. Dane są przechowywane w chmurze i zapisywane na tym urządzeniu do pracy bez internetu. © 2026 Josh",
  },

  admin: {
    loadOrgsFailed: "Nie udało się wczytać listy organizacji.",
    createOrgFailed: "Nie udało się utworzyć organizacji.",
    rotateTokenFailed: "Nie udało się wydać nowego tokenu.",
    patchOrgFailed: "Nie udało się zmienić organizacji.",
    catalogPublished:
      "Opublikowano. Wszyscy zobaczą to przy następnym uruchomieniu.",
    catalogFailed: "Nie udało się zaktualizować katalogu.",
    notValidJson: (file) => `${file} nie jest poprawnym plikiem JSON.`,
    noSongsArray: (file) =>
      `${file} nie zawiera listy „songs” — czy to na pewno ten plik?`,
    imported: (count, book) =>
      `Zaimportowano pieśni: ${count} do śpiewnika ${book} i wysłano do chmury.`,
    importedLocalOnly: (count) =>
      `Zapisano pieśni: ${count} na tym urządzeniu, ale wysyłka do chmury nie powiodła się.`,
    importFailed: "Import nie powiódł się.",

    organizations: "Organizacje",
    organizationsHint:
      "Każda organizacja dostaje jeden token, działający na dowolnej liczbie urządzeń. Cofnięcie tokenu zablokuje je wszystkie przy następnym sprawdzeniu.",
    newOrgPlaceholder: "Nazwa nowej organizacji",
    create: "Utwórz",
    copyTokenNow: "Skopiuj ten token teraz — nie zobaczysz go ponownie.",
    tokenSavedAck: "Zapisałem",
    noOrgs: "Nie ma jeszcze żadnej organizacji.",
    roleAdmin: "administrator",
    revoked: "cofnięty",
    newTokenHint: "Wydaj nowy token — stary przestanie działać",
    newToken: "Nowy token",
    restore: "Przywróć",
    revoke: "Cofnij",

    offered: "Udostępnione do pobrania",
    offeredHint:
      "Z czego użytkownicy mogą wybierać przy uruchomieniu aplikacji.",
    publish: "Opublikuj wybór",

    importSongbook: "Import śpiewnika z pliku JSON",
    importSongbookHint:
      "Zastępuje cały wybrany śpiewnik plikiem przysłanym przez organizację i wysyła go do chmury.",
  },

  contentPicker: {
    nothingPublished: "Nic jeszcze nie opublikowano.",
    allSermons: "Wszystkie kazania",
    allSermonsCount: (count) => `Wszystkie kazania (${count})`,
    sizeHint: (mb) =>
      `Około ${mb} MB — pobierane w całości, nie pojedynczo.`,
    songCount: (name, count) => `${name} (${count})`,
    emptyHint:
      "Bez żadnego wyboru nadal możesz pisać własne pieśni; biblioteka pozostanie ukryta.",
    changeLaterHint: "Możesz to później zmienić w Ustawieniach.",
    skip: "Pomiń",
    continueWithoutData: "Dalej bez danych",
    download: "Pobierz",
    modalTitle: "Pobrane materiały",
    modalHint:
      "Odznaczenie czegoś nie usuwa tego z dysku — po prostu przestaje być aktualizowane.",
    firstRunTitle: "Co pobrać?",
    firstRunHint:
      "Pobierane i aktualizowane jest tylko to, co tutaj zaznaczysz.",
  },

  tokenGate: {
    intro:
      "Wpisz token dostępu swojego zboru. Otrzymasz go od administratora; działa na dowolnej liczbie urządzeń.",
    placeholder: "Token dostępu",
    offline:
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    invalid: "Ten token jest nieprawidłowy. Poproś administratora o nowy.",
    checking: "Sprawdzanie...",
    continue: "Dalej",
  },

  editor: {
    editTitle: "Edycja pieśni",
    newTitle: "Nowa pieśń",
    updateAndMove: "Zapisz i przenieś",
    update: "Zapisz zmiany",
    save: "Zapisz",

    slidesInfoBold:
      "Slajdy są używane tylko przez wyjścia ustawione na „Zapisany” w Ustawieniach → „Co trafia na każde wyjście”.",
    slidesInfoRest:
      "Wyjścia ustawione na „Całość” albo „Maks. linii” dzielą tekst same i slajdy pomijają.",
    keepSplitBefore:
      "Twój własny podział zostanie zachowany dopiero wtedy, gdy fragment ma znacznik ",
    keepSplitBold: "zmieniony",
    keepSplitAfter:
      " — w przeciwnym razie tekst dzieli się od nowa przy każdym wczytaniu.",

    songbook: "Śpiewnik",
    number: "Numer",
    key: "Tonacja",
    moveNoticeBefore: "Po zapisaniu pieśń zostanie przeniesiona ze śpiewnika ",
    moveNoticeMiddle: " do ",
    moveNoticeAfter: ".",
    songName: "Tytuł pieśni",
    songNamePlaceholder: "Tytuł…",
    sequence: "Kolejność zwrotek",

    translationLabel: "Etykieta tłumaczenia",
    translationLabelHint: (detected) =>
      `Napis w ramce na linii nad tłumaczeniem. Zostaw puste, aby użyć ustawienia śpiewnika albo etykiety „${detected}” rozpoznanej z tekstu.`,

    sectionNumberHint: "Numer fragmentu — tylko cyfry",
    removeSecondLanguage: "Usuń drugi język z tego fragmentu",
    addSecondLanguage: "Dodaj drugi język do tego fragmentu",
    secondLanguage: "Drugi język",
    removeSection: "Usuń fragment",

    primaryColumn: "Wyjście 1 — cały fragment",
    lyricsPlaceholder: "Tekst…",
    enterTwiceHint:
      "Naciśnij Enter dwa razy, aby przejść do następnego fragmentu",
    secondLanguagePlaceholder: "Drugi język…",
    translationOnly: "Drugi język to tylko tłumaczenie",
    translationOnlyHint: (label) =>
      `Kursywa i ramka „${label}” na linii rozdzielającej. Zostaw wyłączone, jeśli drugi język też jest śpiewany.`,

    slidesColumn: "Wyjście 2 — slajdy",
    editedBadge: "zmieniony",
    regenerateHint: "Odrzuć ręczne zmiany i podziel tekst od nowa",
    regenerate: "Podziel od nowa",
    addSlide: "Dodaj slajd",
    slidesHint: "Slajdy pojawią się tutaj, gdy zaczniesz pisać po lewej.",
    removeSlide: "Usuń slajd",
    addSection: "Dodaj fragment",

    deleteBold: "Usuń tę pieśń.",
    deleteRest: "Tej operacji nie da się cofnąć.",
    confirmDeleteTitle: "Usunąć tę pieśń?",
    confirmDeleteMessage: (title, everywhere) =>
      `Pieśń „${title}” zostanie trwale usunięta ze śpiewnika${
        everywhere ? " u wszystkich" : " na tym urządzeniu"
      }.`,
  },
};
