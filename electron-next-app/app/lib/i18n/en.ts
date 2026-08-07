export const en = {
  common: {
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    delete: "Delete",
    confirm: "Confirm",
    clear: "Clear",
    copy: "Copy",
    copied: "Copied",
    loading: "Loading...",
    noResults: "No results",
    results: (count: number, more: boolean) =>
      `Results: ${count}${more ? "+" : ""}`,
    showingFirst: (count: number) => `(showing first ${count} results)`,
    clearSearch: "Clear search (Esc)",
    settings: "Settings",
    songs: "Songs",
    bibles: "Bibles",
    bible: "Bible",
    messages: "Messages",
    sermons: "Sermons",
    sermonsLower: "sermons",
    songbooks: "Songbooks",
    mySongs: "My Songs",
  },

  sectionTypes: {
    verse: "Verse",
    chorus: "Chorus",
    bridge: "Bridge",
    ending: "Ending",
  },

  displayGroups: {
    songs: "Songs",
    bible: "Bible",
    messages: "Sermons",
  },

  outputModes: {
    fullscreen: "Fullscreen",
    lowerThirds: "Lower thirds",
  },

  boot: {
    connecting: "Connecting...",
    checkingForData: "Checking for data...",
    downloadingData: (file: string) => `Downloading data — ${file}`,
    cannotLoadData: "Cannot load data",
    connectAndRestart: "Connect to internet and restart the app.",
    bootstrapFailed: "Failed to bootstrap data.",
    noCloudNoCache:
      "Cloud unavailable and no local cache. Connect to internet and restart.",
    tokenExpired:
      "The token is no longer valid. Ask the administrator for a new one.",
    localDataMode: "Local data mode",
  },

  offers: {
    newContentAvailable: "New content available:",
    download: "Download",
    notNow: "Not now",
  },

  preview: {
    toggleVisibility: (name: string) =>
      `Show or hide the ${name} preview`,
  },

  saveStatus: {
    savingToCloud: "Saving to cloud...",
    savingShort: "Saving…",
    syncedToCloud: "Synced to cloud",
    saved: "Saved",
    localOnlyHint:
      "No write token — saved only on this device. Open Settings to add a token.",
    localOnly: "Local only",
    cloudFailedHint:
      "Cloud sync failed — check internet or your write token",
    cloudFailed: "Cloud failed",
  },

  songSave: {
    publishedAdminOnly:
      "Published songbooks can only be changed by the administrator.",
    cannotMoveOutOfPublished:
      "Songs cannot be moved out of a published songbook — only the administrator can change it.",
    copiedButRemoveFailed:
      "Copied to My Songs, but removing from the old songbook failed — song is now in both.",
    movedToMySongs: "Moved to My Songs",
    movedLocallyCloudFailed:
      "Moved locally, but cloud sync failed — others still see it in the old songbook.",
    movedToMySongsLocal: "Moved to My Songs (this device only)",
    saveFailed: "Save failed — nothing was changed.",
    saveRefused:
      "Save was refused — nothing was changed. Check the data and try again.",
    movedTo: (book: string) => `Moved to ${book}`,
    movedToCloudFailed: (book: string) =>
      `Moved to ${book} locally, but cloud sync failed.`,
    movedToLocalOnly: (book: string) => `Moved to ${book} (this device only)`,
    addedButRemoveFailed: (book: string) =>
      `Added to ${book}, but removing from the old songbook failed — song is now in both.`,
    savedLocallyCloudFailed: "Saved locally, but cloud sync failed.",
    deleteFailed: "Delete failed — the song was kept.",
    songDeleted: "Song deleted",
    deletedLocallyCloudFailed: "Deleted locally, but cloud sync failed.",
    deletedThisDeviceOnly: "Deleted on this device only",
  },

  actionBar: {
    removeFromSelected: "Remove from the selected list",
    addToSelected: "Add to the selected list",
    editCurrentSong: "Edit current song",
    addNewSong: "Add new song",
    previousPart: "Previous part (↑)",
    nextPart: "Next part (↓/Space)",
    showText: "Show text (X)",
    hideText: "Hide text (X)",
  },

  selectionHeader: {
    fallbackTitle: "Sections",
    restore: "Put back what you just unselected",
    nothingToRestore: "Nothing to put back",
    unselectHint: "Unselect — clears this list and both outputs",
    nothingSelected: "Nothing is selected",
    unselect: "Unselect",
  },

  selectedPanel: {
    confirmClearTitle: "Clear the selected list?",
    confirmClearMessage: (count: number) =>
      `All ${count} entries will be removed from the list. Nothing is deleted from the songbooks, the Bible or the sermons.`,
    clearAll: "Clear all",
    clearAllHint: "Clear all selected",
    mySongsCount: (count: number) => `My Songs (${count})`,
    selectedCount: (count: number) => `Selected (${count})`,
    reorderHint: "Drag an entry to change the order",
    openOrGoLive: "Click to open, double-click to show it live",
    removeFromSelection: "Remove from selection",
    empty: "Nothing selected yet",
  },

  songRow: {
    editSong: "Edit song",
    alreadySelected: "Already selected",
    addToSelection: "Add to selection",
  },

  songbooksTree: {
    searchPlaceholder: "Search all songbooks...",
    noSongbooks: "No songbooks downloaded — pick some in Settings.",
    resultsCount: (count: number) => `Results: ${count}`,
  },

  bibleBrowser: {
    loading: "Loading Bibles...",
    failed: "Failed to load Bibles",
    unavailable: (name: string) => `${name} (unavailable)`,
    searchPlaceholder: "Search verses...",
    loadOrGoLive: "Click to load, double-click to send to the outputs",
  },

  messagesBrowser: {
    titlePlaceholder: "Title or year...",
    clearTitleSearch: "Clear title search (Esc)",
    fullTextPlaceholder: "Search full text...",
    clearFullTextSearch: "Clear full-text search (Esc)",
    textNotAvailable: "Text not available",
    inMessages: (count: number) => ` in ${count} messages`,
    countOf: (shown: number, total: number) =>
      `Messages: ${shown} of ${total}`,
    count: (total: number) => `Messages: ${total}`,
    noTitlesMatch: "No titles match",
    paragraphShort: "par.",
    titleMatch: "title",
    loadOrGoLive: "Click to load, double-click to send to the outputs",
  },

  sectionsList: {
    pickSomething: "Pick a song, Bible chapter or message to begin.",
    findInMessage: "Find in this message...",
    clearEsc: "Clear (Esc)",
    previousMatch: "Previous match (Shift+Enter)",
    nextMatch: "Next match (Enter)",
    jumpTop: "Jump to the top",
    alreadyTop: "Already at the top",
    jumpCurrent: "Jump to the current chunk",
    nothingLive: "Nothing is live yet",
    currentVisible: "The current chunk is already visible",
    jumpBottom: "Jump to the bottom",
    alreadyBottom: "Already at the bottom",
  },

  songChunks: {
    parts: (count: number) => `${count} parts`,
  },

  monitorPicker: {
    stopToChange: "Stop the output to change monitor",
    choose: "Choose monitor",
    noOtherMonitor: "No other monitor connected.",
    connectProjector: "Connect a projector or a second screen.",
    start: "Start",
    stop: "Stop",
  },

  exactSearch: {
    on: "Exact phrase: on — finds the typed words only as a whole phrase",
    off: "Exact phrase: off — finds all words anywhere",
  },

  outputPreview: {
    boxModePadding: "Padding",
    boxModePaddingHint: "Box hugs the text with a margin around it",
    boxModeFixed: "Fixed",
    boxModeFixedHint:
      "Box keeps the same size no matter how much text there is",
    left: "Left",
    centre: "Centre",
    right: "Right",
    top: "Top",
    bottom: "Bottom",
    fitOn:
      "Preview is enlarged to stay readable — the output is unchanged",
    fitOff: "Preview matches the output exactly",
    delayBadge: (seconds: string) => `+${seconds} s`,
    delayBadgeHint: (seconds: string) =>
      `This output runs ${seconds} s behind, and so does this preview`,
    fit: "Fit",
    oneToOne: "1:1",
    openSettings: (name: string) => `${name} settings`,
    netStart: "Start",
    netStop: "Stop",
    groupLive: (label: string) => `${label} — currently on the output`,
    fade: "Fade",
    textSize: "Text size",
    tightLabels: "Labels close to the text",
    tightLabelsHint:
      "Keeps the reference and the name next to the text instead of at the edges of the frame",
    scale: "Scale",
    anchorX: "Anchor X",
    anchorY: "Anchor Y",
    offsetX: "Left / right",
    offsetY: "Up / down",
    background: "Background behind the text",
    ipOnlyTitle: "IP only — HDMI has no transparency",
    ipOnlyBody:
      "HDMI carries a solid picture with no alpha channel, so the box cannot be see-through — your video would never show through it. It is left undrawn rather than turned into a solid slab. Size and position above still apply. Switch this output to IP to use these.",
    ipOnlyLuma:
      "The frame is black — key it out with a luma key in your streaming software.",
    horizontal: "Horizontal",
    vertical: "Vertical",
    paddingX: "Padding X",
    paddingY: "Padding Y",
    width: "Width",
    height: "Height",
    radius: "Radius",
    darkness: "Darkness",
    softEdges: "Soft edges",
    addressPlaceholder: "Start to get the address",
    copyHint: "Copy — paste into a browser source in your streaming software",
    adapter: "Adapter:",
    couldNotStart: (error: string) => `Could not start: ${error}`,
    noNetworkAddress:
      "No network address found — this machine is not on a LAN.",
    browserSourceHint:
      "Add this address as a browser source in your streaming software. Both computers have to be on the same network, and the firewall must allow incoming connections.",
    dragHint:
      "Drag to move — snaps to centre and to the default position, double-click to reset",
  },

  settings: {
    title: "Settings",
    admin: "Admin",
    backToSettings: "Back to settings",

    confirmWipeTitle: "Delete downloaded data?",
    confirmWipeMessage:
      "Songbooks, Bibles and sermons are removed from this device and the app restarts. Your own songs and the token stay. Anything you pick again gets downloaded from the cloud.",
    confirmWipeButton: "Delete",
    confirmSignOutTitle: "Forget the token?",
    confirmSignOutMessage:
      "The app restarts and asks for a token again. Downloaded data and your own songs stay on the disk.",
    confirmSignOutButton: "Forget",

    outputs: "Outputs",
    outputsHint:
      "Up to two outputs run at once. Each one is sent either to a screen over HDMI or to a web address over IP, and shows either the whole frame or a lower third. Size, position and fade are set separately for Songs, Bible and Sermons from the preview on the right.",
    keepOneOutputOn: "At least one output has to stay on",
    turnOutputOff: "Turn this output off",
    turnOutputOn: "Turn this output on",
    on: "On",
    off: "Off",
    sentBy: "Sent by",
    shows: "Shows",
    hdmiHint: "A window on a second screen",
    ipHint: "A web address other machines open in a browser source",
    fullscreenHint: "Fills the frame — the main projection",
    lowerThirdsHint: "A band of text — for streaming over video",
    hdmiNoAlphaBefore: "Size and position work as usual, but ",
    hdmiNoAlphaBold: "HDMI cannot send transparency",
    hdmiNoAlphaAfter:
      " — it has no alpha channel, so the box behind the text could never let your video show through. Its controls stay visible but greyed out, and the box is not drawn. Switch to IP to use them.",
    delay: "Delay",
    delayUnit: "s",
    delayOff: "off",
    delayHint:
      "Holds this output behind by the set time — every change reaches it that much later, in the order you made it. Useful when a stream or a projector runs behind the room. Leave at 0 for no delay. Set per output, so the other one is unaffected.",

    lowerThirdsNote:
      "Transparent overlay with a shaped, dimmed box behind the text. Size and position are set per Songs / Bible / Sermons in the preview.",
    fullscreenNote:
      "Fills the frame. Text size and fade are set per Songs / Bible / Sermons in the preview.",

    whatGoesOnOutputs: "What goes on each output",
    whatGoesOnOutputsHint:
      "How much text each output shows and which captions it prints, set per songbook. Whole = the entire section, Saved = the split stored with the song, Max lines = split evenly into parts of at most N lines, smallest part first.",
    groupWhole: "Whole",
    groupSaved: "Saved",
    groupMaxLines: "Max lines",
    copyToEverySongbook: "Copy to every songbook",

    chromeSongHeader: "Section label (top left)",
    chromeSongFooter: "Song caption (bottom)",
    chromeBibleHeader: "Reference",
    chromeBibleFooter: "Bible name",
    chromeMessageHeader: "Title on top",
    chromeMessageFooter: "Title below",
    chromeSequence: "Sequence (top right)",
    chromeSecondary: "Second language",
    chromeSwapLabels: "Swap top and bottom",
    chromeSwapLabelsHint:
      "Puts the Bible name on top and the reference below",

    downloadedContent: "Downloaded content",
    nowDownloaded: (summary: string) =>
      `Now downloaded: ${summary}. Only these are kept up to date.`,
    nothingDownloaded:
      "Nothing is downloaded yet, so the library on the left is empty.",
    chooseWhatToDownload: "Choose what to download",
    deleteDownloadedData: "Delete downloaded data",

    access: "Access",
    signedInAs: (name: string, isAdmin: boolean) =>
      `Signed in as ${name}${
        isAdmin ? " (admin)" : ""
      }. The token works on any number of devices.`,
    notSignedIn: "Not signed in.",
    forgetToken: "Forget token on this device",

    appearance: "Appearance",
    themeDark: "Dark",
    themeLight: "Light",
    themeSystem: "System",
    language: "Language",

    songFooter: "Song footer on the fullscreen output",
    songFooterHint:
      "Which parts of the caption are printed under the lyrics, per songbook. Bible chapters and messages have their own caption and are not affected.",
    footerNumber: "Number",
    footerTitle: "Title",
    footerKey: "Key",
    footerCell: (field: string, book: string) => `${field} — ${book}`,

    divider: "Divider between languages",
    dividerHint:
      "Thickness of the line between the two languages and of the box around the translation label. Applies to all outputs.",

    translationLabel: "Translation label",
    translationLabelHint:
      "Text of the box printed on the divider above a translation, per songbook. Leave empty to detect it from the text of the translation. A song can override this in the editor.",
    translationLabelAuto: (fallback: string) => `auto (${fallback})`,

    backup: "Backup",
    backupHint:
      "Export a copy of the data to a folder of your choice (e.g. Downloads or Desktop). Do this from time to time so nothing gets lost.",
    exportAll: "Export all",
    exporting: "Exporting…",
    exported: (files: number, path: string) =>
      `Exported ${files} files to ${path}`,
    exportFailed: "Export failed.",

    cloudData: "Cloud data",
    localVersion: "Local version:",
    cloudVersion: "Cloud version:",
    updateAvailable: "New data available on cloud. Click below to update.",
    updateNow: "Update now",
    forceResyncHint:
      "Re-download the content you have selected, ignoring local hashes",
    syncing: "Syncing…",
    forceResync: "Force re-sync",
    dataUpdated: "Data updated.",
    syncFailed: "Sync failed",
    upToDate: "Up to date",

    writeToken: "Write token",
    writeTokenHint:
      "Token to authorize saving song edits to the shared cloud database. Without a token, edits are saved only locally on this device. Ask the admin for a token.",
    tokenSaved: "•••••••••• (saved)",
    tokenPlaceholder: "Paste your token",
    tokenSavedMsg: "Saved.",
    tokenSaveFailed: "Failed to save.",
    tokenCleared: "Cleared.",
    status: "Status:",
    writeEnabled: "Write access enabled — edits sync to cloud",
    readOnly: "Read-only — edits stay on this device",

    about:
      "— presentation app for songs, Bible verses and sermons. Two independent outputs, each either a full-screen projection or a lower third for streaming. Data is stored in the cloud and cached on this device for offline use. © 2026 Josh",
  },

  admin: {
    loadOrgsFailed: "Could not load organizations.",
    createOrgFailed: "Could not create the organization.",
    rotateTokenFailed: "Could not issue a new token.",
    patchOrgFailed: "Could not change the organization.",
    catalogPublished: "Published. Everyone sees this on their next start.",
    catalogFailed: "Could not update the catalog.",
    notValidJson: (file: string) => `${file} is not valid JSON.`,
    noSongsArray: (file: string) =>
      `${file} has no "songs" array — wrong file?`,
    imported: (count: number, book: string) =>
      `Imported ${count} songs into ${book} and uploaded.`,
    importedLocalOnly: (count: number) =>
      `Saved ${count} songs locally, but the upload failed.`,
    importFailed: "Import failed.",

    organizations: "Organizations",
    organizationsHint:
      "Each organization gets one token, usable on any number of devices. Revoking locks every one of them on the next check.",
    newOrgPlaceholder: "New organization name",
    create: "Create",
    copyTokenNow: "Copy this token now — it is never shown again.",
    tokenSavedAck: "I saved it",
    noOrgs: "No organizations yet.",
    roleAdmin: "admin",
    revoked: "revoked",
    newTokenHint: "Issue a new token — the old one stops working",
    newToken: "New token",
    restore: "Restore",
    revoke: "Revoke",

    offered: "Offered for download",
    offeredHint: "What everyone gets to pick from when they start the app.",
    publish: "Publish selection",

    importSongbook: "Import a songbook JSON",
    importSongbookHint:
      "Replaces the whole target songbook with the file an organization sent you, and uploads it.",
  },

  contentPicker: {
    nothingPublished: "Nothing published yet.",
    allSermons: "All sermons",
    allSermonsCount: (count: number) => `All sermons (${count})`,
    sizeHint: (mb: number) =>
      `About ${mb} MB — downloaded as one set, not one by one.`,
    songCount: (name: string, count: number) => `${name} (${count})`,
    emptyHint:
      "With nothing selected you can still write your own songs; the library stays hidden.",
    changeLaterHint: "You can change this later in Settings.",
    skip: "Skip",
    continueWithoutData: "Continue without data",
    download: "Download",
    modalTitle: "Downloaded content",
    modalHint:
      "Unchecking something does not delete what is already on the disk; it stops being kept up to date.",
    firstRunTitle: "What should we download?",
    firstRunHint: "Only what you pick is downloaded and kept up to date.",
  },

  tokenGate: {
    intro:
      "Enter the access token for your congregation. You get it from the administrator and it works on any number of devices.",
    placeholder: "Access token",
    offline: "No connection to the server. Check the internet and try again.",
    invalid: "This token is not valid. Ask the administrator for a new one.",
    checking: "Checking...",
    continue: "Continue",
  },

  editor: {
    editTitle: "Edit song",
    newTitle: "New song",
    updateAndMove: "Update & Move",
    update: "Update",
    save: "Save",

    slidesInfoBold:
      "Slides are used only by outputs set to “Saved” in Settings → “What goes on each output”.",
    slidesInfoRest:
      "Outputs set to “Whole” or “Max lines” split the text themselves and ignore them.",
    keepSplitBefore: "Your own split is kept only once a section is marked ",
    keepSplitBold: "edited",
    keepSplitAfter: " — otherwise it is split again on every load.",

    songbook: "Songbook",
    number: "Number",
    key: "Key",
    moveNoticeBefore: "On save, the song will be moved from ",
    moveNoticeMiddle: " to ",
    moveNoticeAfter: ".",
    songName: "Song name",
    songNamePlaceholder: "Title…",
    sequence: "Sequence",

    translationLabel: "Translation label",
    translationLabelHint: (detected: string) =>
      `Shown in the box on the divider above the translation. Leave empty to use the songbook setting, or „${detected}” detected from the text.`,

    sectionNumberHint: "Section number — digits only",
    removeSecondLanguage: "Remove the second language from this section",
    addSecondLanguage: "Add a second language to this section",
    secondLanguage: "Second language",
    removeSection: "Remove section",

    primaryColumn: "Output 1 — full section",
    lyricsPlaceholder: "Lyrics…",
    enterTwiceHint: "Press Enter twice to move to the next section",
    secondLanguagePlaceholder: "Second language…",
    translationOnly: "Second language is a translation only",
    translationOnlyHint: (label: string) =>
      `Italics + a „${label}” box on the divider. Leave off when the second language is also sung.`,

    slidesColumn: "Output 2 — slides",
    editedBadge: "edited",
    regenerateHint: "Discard manual edits and split again",
    regenerate: "Regenerate",
    addSlide: "Add slide",
    slidesHint: "Slides appear here as you type on the left.",
    removeSlide: "Remove slide",
    addSection: "Add Section",

    deleteBold: "Delete this song.",
    deleteRest: "This action is irreversible.",
    confirmDeleteTitle: "Delete this song?",
    confirmDeleteMessage: (title: string, everywhere: boolean) =>
      `"${title}" will be permanently removed from the songbook${
        everywhere ? " for everyone" : " on this device"
      }.`,
  },
};

export type Dict = typeof en;
