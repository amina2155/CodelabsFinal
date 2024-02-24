import { io } from "https://cdn.socket.io/4.4.1/socket.io.esm.min.js";

import * as Y from 'https://cdn.jsdelivr.net/npm/yjs@13.6.8/+esm';
import { WebrtcProvider } from 'https://cdn.jsdelivr.net/npm/y-webrtc@10.2.5/+esm';
import { MonacoBinding } from 'https://cdn.jsdelivr.net/npm/y-monaco@0.1.5/+esm';

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

const socket = io();

//When a user is logged in
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        displayUserInfo(user);
    } else {
        window.location.href = "/login";
    }
});

var currentUserUID;
var currentRoomUID;

let currentUserInfo = {
    connectionId: null,

    userId: null,
    userName: null,
    displayName: null,
    email: null,
    role: null,
    imageUrl: null,

    roomId: null,

    fileData: null,
    editorData: null,
    consoleData: null,
    collabData: null
};

let currentRoomInfo = {
    name: null,
    creatorId: null
};

let yData = {};

let currentUserFiles = {};

let availableFileExtension = {
    "c": "c",
    "h": "c",
    "cpp": "cpp",
    "cc": "cpp",
    "hpp": "cpp",
    "js": "javascript",
    "jsx": "javascript",
    "py": "python",
    "cpy": "python",
    "rpy": "python"
}

let selectedEditorFileOption = null;

let fileContentEditor;
let fileContentEditorConfig = { value: "", theme: "chrome-dev", language: "plaintext", automaticLayout: "true" };

//User information is set
function displayUserInfo(user) {
    let username_now;

    const fullname = document.getElementById("full-name-id");
    const emailid = document.getElementById("email-id");
    const profilepicture = document.getElementById("profile-picture");
    const profileicon = document.getElementById("profile-icon");

    firebase
        .database()
        .ref("users/" + firebase.auth().currentUser.uid + "/username")
        .get()
        .then((snapshot) => {
            username_now = snapshot.val();

            console.log("Username: ", username_now);

            currentUserUID = firebase.auth().currentUser.uid;

            fullname.innerHTML = `${user.displayName}`;
            emailid.innerHTML = `${user.email}`;

            currentUserInfo.userId = currentUserUID;
            currentUserInfo.userName = username_now;
            currentUserInfo.displayName = user.displayName;
            currentUserInfo.email = user.email;
            currentUserInfo.role = "participant";

            if (user.photoURL == null) {
                profilepicture.src = `${"/image/download.png"}`;
                profileicon.src = `${"/image/download.png"}`;

                currentUserInfo.imageUrl = `${"/image/download.png"}`;
            } else {
                profilepicture.src = `${user.photoURL}`;
                profileicon.src = `${user.photoURL}`;

                currentUserInfo.imageUrl = `${user.photoURL}`;
            }

            checkRoomInfo();
            collectFileInfo().then(() => {
                displayFileInfo();
                deployRoomConnectivity();
            });
        })
        .catch((error) => {
            console.error("Error fetching username:", error);
            window.location.href = "/error";
        });
}

//checking room information
function checkRoomInfo() {
    if (window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);

        if (!searchParams.has('rmid')) {
            window.location.href = "/error";
        }

        currentRoomUID = searchParams.get('rmid');

        currentUserInfo.roomId = currentRoomUID;

        let currentRoomType = searchParams.get('rmtp');

        firebase
            .database()
            .ref("rooms/" + currentRoomUID)
            .get()
            .then((snapshot) => {
                let roomParticipants = snapshot.val().participants;

                if (Object.values(roomParticipants).includes(currentUserUID)) {
                    // history.replaceState({}, document.title, window.location.pathname + `/${currentRoomUID}`);

                    currentRoomInfo.creatorId = snapshot.val().creatorUserid;
                    currentRoomInfo.name = snapshot.val().roomname;

                    firebase
                        .database()
                        .ref("users/" + currentUserUID + "/joinedRooms")
                        .get()
                        .then((snapshot) => {
                            let userJoinedRooms = snapshot.val();

                            if (Object.values(userJoinedRooms).includes(`${currentRoomInfo.name}#${currentRoomType}#${currentRoomUID}`)) {
                                
                                let roomNameText = document.getElementById('room-name-text');
                                roomNameText.innerText = currentRoomInfo.name;
                            
                            } else {
                                window.location.href = "/error";
                            }
                        })
                        .catch((error) => {
                            console.error("Error fetching user joined room info:", error);
                            window.location.href = "/error";
                        });

                } else {
                    window.location.href = "/error";
                }
            })
            .catch((error) => {
                console.error("Error fetching room participants:", error);
                window.location.href = "/error";
            });
    } else {
        window.location.href = "/error";
    }
}

//collecting user file information
function collectFileInfo() {
    return new Promise((resolve, reject) => {
        currentUserFiles = {};
        const userFilesRef = firebase.database().ref(`files/${currentRoomUID}/${currentUserUID}`);

        userFilesRef.once("value").then(snapshot => {
            const filesInRealTime = snapshot.val();

            // console.log(files);

            if (filesInRealTime) {
                const promises = [];
                Object.keys(filesInRealTime).forEach(fileNameWithEXT => {

                    const filePathWithEXT = `${currentRoomUID}/${currentUserUID}/${fileNameWithEXT}`;

                    console.log(fileNameWithEXT);
                    console.log(filePathWithEXT);
                    console.log(filesInRealTime[fileNameWithEXT]);

                    const storageRef = firebase.storage().ref(filePathWithEXT);
                    const promise = storageRef.getDownloadURL().then(url => {
                        return fetch(url)
                            .then(response => response.text())
                            .then(data => {
                                currentUserFiles[fileNameWithEXT] = data;
                            });
                    });
                    promises.push(promise);
                });
                // console.log(currentUserFiles);

                Promise.all(promises)
                    .then(() => {
                        resolve(); // Resolve the promise once all files are loaded
                    })
                    .catch(error => {
                        reject(error); // Reject if there's an error fetching files
                    });
            } else {
                resolve(); // Resolve if no files are found
            }
        });
    });
}

//sorting user file information
function sortCurrentUserFiles() {
    const sortedFileObject = {};
    Object.keys(currentUserFiles)
        .sort()
        .forEach(key => {
            sortedFileObject[key] = currentUserFiles[key];
        });

    currentUserFiles = sortedFileObject;
}

//displaying user file information
function displayFileInfo() {
    console.log(currentUserFiles);

    sortCurrentUserFiles();
    Object.keys(currentUserFiles).forEach(ExtDashName => {
        generateEditorFileOption(ExtDashName);
    });
}

//deploying room connections
function deployRoomConnectivity() {
    let videconPlatform = document.getElementById('videocon-iframe');
    videconPlatform.setAttribute('src', `/videocon?roomID=${currentRoomUID}&userID=${currentUserInfo.userId}&userName=${currentUserInfo.displayName}`);

    currentUserInfo.connectionId = socket.id;

    const shareTag = 'room' + currentRoomUID + '@' + currentUserUID;
    const signalingServerList = ["wss://34.148.18.59:5555"];

    const ydoc = new Y.Doc();
    const type = ydoc.getText('monaco');
    const provider = new WebrtcProvider(shareTag, ydoc, { signaling: signalingServerList });

    currentUserInfo.collabData = { shareStatus: false, shareTag, signalingServerList };
    yData = { ydoc, provider, type, binding: null };

    socket.emit('setup-peer-connection', currentUserInfo);

    socket.on('provide-peer-config', () => {
        socket.emit('setup-peer-connection', currentUserInfo);
    });

    socket.on('accept-input', (observerInfo) => {
        alert(`Your instructor, ${observerInfo.displayName}, has  shared an input example.`);

        let inputConsoleWindow = document.getElementById('file-input-window-textarea');
        inputConsoleWindow.value += `// Your instructor's input example\n${observerInfo.consoleData}`;
    });
}

/* ///////////////////////////////////////////////////////////////////// */
/* profile script */
/* ///////////////////////////////////////////////////////////////////// */

//User log out handling
document.getElementById("logout").addEventListener("click", () => {
    firebase
        .database()
        .ref("users/" + firebase.auth().currentUser.uid)
        .update({
            logoutTime: new Date().toString(),
            login_status: "false",
            logout_status: "true",
        });
    firebase
        .auth()
        .signOut()
        .then(() => {
            window.location.href = "/login";
        })
        .catch((error) => {
            console.error(error);
        });
});

//Profile pop up portion handling
const profileIcon = document.getElementById("profile-icon");
const profilePopup = document.getElementById("profile-popup");

//If icon is clicked, it toggles the pop up between open and close
profileIcon.addEventListener("click", () => {
    toggleProfilePopup();
});

//If anywhere else in the page is clicked, pop up is closed
document.addEventListener("click", (event) => {
    if (!profilePopup.contains(event.target) && event.target != profileIcon) {
        closeProfilePopup();
    }
});

function toggleProfilePopup() {
    if (profilePopup.style.display === "block") {
        closeProfilePopup();
    } else {
        profilePopup.style.display = "block";
    }
}

function closeProfilePopup() {
    profilePopup.style.display = "none";
}

//Notification icon also opens a pop up, handling just like profile pop up
const notificationIcon = document.getElementById("notification-icon");
const notificationPopup = document.getElementById("notification-popup");

notificationIcon.addEventListener("click", () => {
    toggleNotificationPopup();
});

document.addEventListener("click", (event) => {
    if (!notificationPopup.contains(event.target) &&
        event.target !== notificationIcon) {

        closeNotificationPopup();
    }
});

function toggleNotificationPopup() {
    if (notificationPopup.style.display === "block") {
        closeNotificationPopup();
    } else {
        notificationPopup.style.display = "block";
    }
}

function closeNotificationPopup() {
    notificationPopup.style.display = "none";
}

//Handling the home icon event
const homeReturnButton = document.getElementById("home-icon");
homeReturnButton.onclick = (e) => {
    window.location.href = "/profile";
};

//Handling profile name event
const profileNameEditIcon = document.getElementById("profile-name-edit-icon");
const profileNameInput = document.getElementById("profile-name-input");
const fullName = document.getElementById("full-name-id");
const editNameSaveIcon = document.getElementById("profile-name-save-icon");

profileNameEditIcon.addEventListener("click", () => {
    toggleProfileNameOptions();
});

function toggleProfileNameOptions() {
    if (fullName.style.display === "none") {
        fullName.style.display = "block";
        profileNameInput.style.display = "none";
        editNameSaveIcon.style.display = "none";
    } else {
        fullName.style.display = "none";
        profileNameInput.style.display = "block";
        editNameSaveIcon.style.display = "flex";

        profileNameInput.focus();

        profileNameInput.value = fullName.innerHTML;
    }
}

editNameSaveIcon.addEventListener("click", () => {
    const editedName = profileNameInput.value;

    const userId = firebase.auth().currentUser.uid;

    firebase
        .database()
        .ref("users/" + userId)
        .update({
            displayName: editedName,
        })
        .then(() => {
            firebase
                .auth()
                .currentUser.updateProfile({
                    displayName: editedName,
                })
                .then(() => {
                    document.getElementById("full-name-id").innerHTML = editedName;
                    toggleProfileNameOptions();
                })
                .catch((error) => {
                    console.error("Error updating profile name :", error);
                });
            // document.getElementById("full-name-id").innerHTML = editedName;
            // toggleProfileNameOptions();
        })
        .catch((error) => {
            console.error("Error updating display name in the database:", error);
        });
});

//Editing profile picture handling
const removeProfilePictureBtn = document.getElementById(
    "remove-profile-picture"
);
const profilePictureOptions = document.getElementById(
    "profile-picture-options"
);

document.getElementById("profile-edit-icon").addEventListener("click", () => {
    toggleProfilePictureOptions();
});

removeProfilePictureBtn.addEventListener("click", () => {
    clearProfilePicture();
});

//Two buttons appear or disappear
function toggleProfilePictureOptions() {
    if (profilePictureOptions.style.display === "block") {
        profilePictureOptions.style.display = "none";
    } else {
        profilePictureOptions.style.display = "block";
    }
}

//Deleting profile picture from firebase storage under a particular user
//Identify user by userId
function deleteProfilePictureFromStorage() {
    const userId = firebase.auth().currentUser.uid;

    const currentUser = firebase.auth().currentUser;
    const currentPhotoURL = currentUser ? currentUser.photoURL : null;

    if (currentPhotoURL) {
        const storageRef = firebase.storage().refFromURL(currentPhotoURL);
        return storageRef.delete();
    } else {
        return Promise.resolve();
    }
}

//Clearing profile ppicture from icon and pop up as well as from database
function clearProfilePicture() {
    const userId = firebase.auth().currentUser.uid;

    deleteProfilePictureFromStorage()
        .then(() => {
            console.log("Profile picture deleted from Firebase Storage");

            return firebase
                .database()
                .ref("users/" + userId)
                .update({
                    profilePicture: null,
                });
        })
        .then(() => {
            return firebase.auth().currentUser.updateProfile({
                photoURL: "",
            });
        })
        .then(() => {
            document.getElementById("profile-picture").src = "/image/download.png";
            document.getElementById("profile-icon").src = "/image/download.png";
        })
        .catch((error) => {
            console.error("Error clearing profile picture:", error);
        });
}

// A file type input which will accept only images
const changeProfilePictureBtn = document.getElementById("change-profile-picture");
const profilePictureInput = document.getElementById("profile-picture-input");

changeProfilePictureBtn.addEventListener("click", () => {
    profilePictureInput.click();
});

profilePictureInput.addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (file) {
        uploadProfilePicture(file);
    }
});

function uploadProfilePicture(file) {
    const userId = firebase.auth().currentUser.uid;
    const storageRef = firebase.storage().ref(`profile-pictures/${userId}`);

    //Uploading file in firebase storage
    const uploadTask = storageRef.put(file);

    uploadTask.on(
        "state_changed",
        (snapshot) => { },
        (error) => {
            console.error("Error uploading profile picture:", error);
        },
        () => {
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                //Setting the link of picture from the storage as the profilePicture portion of a particular user
                firebase
                    .database()
                    .ref("users/" + userId)
                    .update({
                        profilePicture: downloadURL,
                    })
                    .then(() => {
                        //Setting the authentication image as the storage image
                        firebase
                            .auth()
                            .currentUser.updateProfile({
                                photoURL: downloadURL,
                            })
                            .then(() => {
                                document.getElementById("profile-picture").src = downloadURL;
                                document.getElementById("profile-icon").src = downloadURL;
                            })
                            .catch((error) => {
                                console.error("Error updating profile picture URL:", error);
                            });
                    })
                    .catch((error) => {
                        console.error(
                            "Error updating profile picture in the database:",
                            error
                        );
                    });
            });
        }
    );
}

/* ///////////////////////////////////////////////////////////////////// */
/* utility script */
/* ///////////////////////////////////////////////////////////////////// */

function applyUtilInteraction() {
    let selectedPageSectionIdx = 0;

    let pageSectionUtilOptions = [...document.getElementsByClassName('util-tray-button')];

    pageSectionUtilOptions.forEach((utilOption, utilOptionIdx) => {
        utilOption.onclick = (e) => {
            if (selectedPageSectionIdx === utilOptionIdx) return;

            deselectPageSectiontUtilOption(selectedPageSectionIdx);
            hidePageSection(selectedPageSectionIdx);

            selectedPageSectionIdx = utilOptionIdx;

            selectPageSectiontUtilOption(selectedPageSectionIdx);
            showPageSection(selectedPageSectionIdx);
        };
    });

    function selectPageSectiontUtilOption(optionIdx) {
        pageSectionUtilOptions[optionIdx].classList.add('selected-util-button');
    }

    function deselectPageSectiontUtilOption(optionIdx) {
        pageSectionUtilOptions[optionIdx].classList.remove('selected-util-button');
    }

    function showPageSection(pageSectionIdx) {
        if (pageSectionIdx === 0) {
            let editorPageSection = document.getElementById('editor-section');
            editorPageSection.classList.remove('hide-section');
        } else if (pageSectionIdx === 1) {
            let videoconPageSection = document.getElementById('videocon-section');
            videoconPageSection.classList.remove('hide-section');
        }
    }

    function hidePageSection(pageSectionIdx) {
        if (pageSectionIdx === 0) {
            let editorPageSection = document.getElementById('editor-section');
            editorPageSection.classList.add('hide-section');
        } else if (pageSectionIdx === 1) {
            let videoconPageSection = document.getElementById('videocon-section');
            videoconPageSection.classList.add('hide-section');
        }
    }
}

applyUtilInteraction();

/* ///////////////////////////////////////////////////////////////////// */
/* common utility script */
/* ///////////////////////////////////////////////////////////////////// */

function activateEditorSectionButton(editorSectionButtonElement) {
    editorSectionButtonElement.classList.add('editor-section-button-activate');
    editorSectionButtonElement.firstElementChild.classList.add('fa-fade');
}

function deactivateEditorSectionButton(editorSectionButtonElement) {
    editorSectionButtonElement.classList.remove('editor-section-button-activate');
    editorSectionButtonElement.firstElementChild.classList.remove('fa-fade');
}

/* ///////////////////////////////////////////////////////////////////// */
/* file tree create script */
/* ///////////////////////////////////////////////////////////////////// */

function applyFileTreeCreateInteraction() {
    let createNewFileButton = document.getElementById('create-new-file-button');

    let fileCreateControlSection = document.getElementById('file-tree-create-control');
    let fileCreateControlSectionInput = document.getElementById('file-create-input');

    createNewFileButton.onclick = (e) => {
        activateEditorSectionButton(createNewFileButton);

        fileCreateControlSection.classList.remove('hide-file-tree-control');

        fileCreateControlSectionInput.value = "";
        fileCreateControlSectionInput.focus();

        document.addEventListener('mousedown', cancelCreateNewFile);
        document.addEventListener('keydown', confirmCreateNewFile);
    }

    function confirmCreateNewFile(e) {
        if (e.key === 'Enter') {
            let createFileInput = fileCreateControlSectionInput.value;

            if (createFileInput.trim() == "") return;

            let lastDotIndex = createFileInput.lastIndexOf('.');
            let fileName = createFileInput;
            let fileExtension = "";
            let EXT_DashFileName = "";

            if (lastDotIndex !== -1) {
                fileExtension = createFileInput.substring(lastDotIndex + 1);

                console.log(fileExtension);

                if (availableFileExtension[fileExtension]) {
                    fileName = createFileInput.substring(0, lastDotIndex);
                }
                else {
                    alert("Wrong extension entered!");
                    return;
                }
            } else {
                fileExtension = "txt";
            }

            const invalidCharsRegex = /[.#$\[\]]/;

            if (fileName.trim() !== "" && !invalidCharsRegex.test(fileName)) {

                EXT_DashFileName = `${fileExtension}-${fileName}`;

                const EXT_DashFileNameWithpath = `${currentRoomUID}/${currentUserUID}/${EXT_DashFileName}`;

                if (currentUserFiles[EXT_DashFileName]) {
                    alert("File name already exists. Please enter a different name.");
                    return;
                }

                const storageRef = firebase.storage().ref(EXT_DashFileNameWithpath);

                const fileRef = firebase.database().ref(`files/${currentRoomUID}/${currentUserUID}/${EXT_DashFileName}`);

                storageRef.putString("").then(() => {
                    currentUserFiles[EXT_DashFileName] = "";
                    console.log(EXT_DashFileName);

                    fileRef.set(storageRef.fullPath);
                    generateEditorFileOption(EXT_DashFileName);

                    cancelCreateNewFile();
                })
                    .catch((error) => {
                        console.error("Error saving file:", error);
                    });
            } else {
                alert("Please enter a valid file name without '.', '#', '$', '[', or ']'.");
            }
        }
    }

    function showCreateFileError() {
        // TODO: show error
        // fileCreateControlSectionInput.classList.add('file-tree-control-input-error');
        // view error modal
    }

    function cancelCreateNewFile() {
        document.removeEventListener('mousedown', cancelCreateNewFile);
        document.removeEventListener('keydown', confirmCreateNewFile);

        deactivateEditorSectionButton(createNewFileButton);

        fileCreateControlSection.classList.add('hide-file-tree-control');
    }
}

applyFileTreeCreateInteraction();

/* ///////////////////////////////////////////////////////////////////// */
/* file console script */
/* ///////////////////////////////////////////////////////////////////// */

function applyFileConsoleInteraction() {
    let selectedConsoleWindowIdx = 0;

    let consoleWindowOptions = [...document.getElementsByClassName('file-console-option')];

    consoleWindowOptions.forEach((option, optionIdx) => {
        option.onclick = (e) => {
            if (selectedConsoleWindowIdx === optionIdx) return;

            deselectConsoleWindowOption(selectedConsoleWindowIdx);
            hideConsoleWindow(selectedConsoleWindowIdx);

            selectedConsoleWindowIdx = optionIdx;

            selectConsoleWindowOption(selectedConsoleWindowIdx);
            showConsoleWindow(selectedConsoleWindowIdx);
        };
    });

    function selectConsoleWindowOption(optionIdx) {
        consoleWindowOptions[optionIdx].classList.add('selected-console-option');
    }

    function deselectConsoleWindowOption(optionIdx) {
        consoleWindowOptions[optionIdx].classList.remove('selected-console-option');
    }

    function showConsoleWindow(consoleWindowIdx) {
        let consoleWindow = findConsoleWindow(consoleWindowIdx);
        consoleWindow.classList.remove('hide-console-window');
    }

    function hideConsoleWindow(consoleWindowIdx) {
        let consoleWindow = findConsoleWindow(consoleWindowIdx);
        consoleWindow.classList.add('hide-console-window');
    }

    function findConsoleWindow(consoleWindowIdx) {
        if (consoleWindowIdx === 0) {
            return document.getElementById('file-input-window');
        } else if (consoleWindowIdx === 1) {
            return document.getElementById('file-output-window');
        }
    }

    let consoleGripSlider = document.getElementById('console-grip-slider');
    let fileConsole = document.getElementById('file-console');

    let minimumConsoleWindowSize, maximumConsoleWindowSize, currentConsoleWindowSize, calcConsoleWindowSize;
    let prevCurPosY, currCurPosY, calcDistY;

    function consoleGripSlider_mouseDownHandler(e) {
        minimumConsoleWindowSize = parseInt(window.getComputedStyle(document.getElementById('file-console-header')).height);
        maximumConsoleWindowSize = parseInt(window.getComputedStyle(document.getElementById('file-stat')).height);

        currentConsoleWindowSize = parseInt(window.getComputedStyle(document.getElementById('file-console')).height);

        prevCurPosY = e.clientY;

        consoleGripSlider.classList.add('grip-slider-selected');

        document.addEventListener('mousemove', consoleGripSlider_mouseMoveHandler);
        document.addEventListener('mouseup', consoleGripSlider_mouseUpHandler);
    }

    function consoleGripSlider_mouseMoveHandler(e) {
        currCurPosY = e.clientY;
        calcDistY = currCurPosY - prevCurPosY;
        calcConsoleWindowSize = currentConsoleWindowSize - calcDistY;

        if (calcConsoleWindowSize < minimumConsoleWindowSize) {
            fileConsole.style.height = `${minimumConsoleWindowSize}px`;
        } else if (calcConsoleWindowSize > maximumConsoleWindowSize) {
            fileConsole.style.height = `${maximumConsoleWindowSize}px`;
        } else {
            fileConsole.style.height = `${calcConsoleWindowSize}px`;
        }
    }

    function consoleGripSlider_mouseUpHandler(e) {
        consoleGripSlider.classList.remove('grip-slider-selected');

        document.removeEventListener("mouseup", consoleGripSlider_mouseUpHandler);
        document.removeEventListener("mousemove", consoleGripSlider_mouseMoveHandler);
    }

    consoleGripSlider.addEventListener('mousedown', consoleGripSlider_mouseDownHandler);

    let consoleFontSizeDecreaseButton = document.getElementById('console-font-size-decrease-button');
    let consoleFontSizeIncreaseButton = document.getElementById('console-font-size-increase-button');

    let currentConsoleFontSizeInREM = [1, 1];

    consoleFontSizeDecreaseButton.onclick = () => {
        if (currentConsoleFontSizeInREM[selectedConsoleWindowIdx] <= 0.8) return;

        let consoleWindowTextarea;

        if (selectedConsoleWindowIdx === 0) {
            consoleWindowTextarea = document.getElementById('file-input-window-textarea');
        } else if (selectedConsoleWindowIdx === 1) {
            consoleWindowTextarea = document.getElementById('file-output-window-textarea');
        }

        currentConsoleFontSizeInREM[selectedConsoleWindowIdx] -= 0.2;

        consoleWindowTextarea.style.fontSize = `${currentConsoleFontSizeInREM[selectedConsoleWindowIdx]}rem`;
    };

    consoleFontSizeIncreaseButton.onclick = () => {
        let consoleWindowTextarea;

        if (selectedConsoleWindowIdx === 0) {
            consoleWindowTextarea = document.getElementById('file-input-window-textarea');
        } else if (selectedConsoleWindowIdx === 1) {
            consoleWindowTextarea = document.getElementById('file-output-window-textarea');
        }

        currentConsoleFontSizeInREM[selectedConsoleWindowIdx] += 0.2;

        consoleWindowTextarea.style.fontSize = `${currentConsoleFontSizeInREM[selectedConsoleWindowIdx]}rem`;
    };

    let consoleInputShareButton = document.getElementById('console-input-share-button');

    consoleInputShareButton.onclick = () => {
        let inputConsoleWindow = document.getElementById('file-input-window-textarea');

        currentUserInfo.consoleData = inputConsoleWindow.value;

        socket.emit('participant-input-shared', currentUserInfo);
    };
}

applyFileConsoleInteraction();

/* ///////////////////////////////////////////////////////////////////// */
/* file content script */
/* ///////////////////////////////////////////////////////////////////// */

function applyFileContentInteraction() {
    let fileContenSaveButton = document.getElementById('save-file-button');
    let fileContenRunButton = document.getElementById('run-file-button');
    let fileContenDownloadButton = document.getElementById('download-file-button');

    let fileContentZoomInButton = document.getElementById('zoom-in-file-button');
    let fileContentZoomOutButton = document.getElementById('zoom-out-file-button');

    let baseFontSize = 14;
    let zoomLevel = 1;

    require(["vs/editor/editor.main"], () => {
        window.MonacoEnvironment = {
            getWorkerUrl: function (workerId, label) {
                return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                self.MonacoEnvironment = {
                    baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min'
                };
                importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/base/worker/workerMain.js');`
                )}`;
            }
        };

        loadMonacoEditor();

        function loadMonacoEditor() {
            fetch('https://cdn.jsdelivr.net/npm/monaco-themes@0.4.4/themes/Chrome%20DevTools.json')
                .then(data => data.json())
                .then(data => {
                    monaco.editor.defineTheme('chrome-dev', data);
                    monaco.editor.setTheme('chrome-dev');

                    fileContentEditor = monaco.editor.create(document.getElementById('file-content'), fileContentEditorConfig);

                    currentUserInfo.editorData = fileContentEditorConfig;

                    fileContenSaveButton.addEventListener('click', saveFileContent);
                    fileContenRunButton.addEventListener('click', runFileContent);
                    fileContenDownloadButton.addEventListener('click', downloadFileContent);

                    fileContentZoomInButton.addEventListener('click', zoomInFileContent);
                    fileContentZoomOutButton.addEventListener('click', zoomOutFileContent);
                });
        }
    });

    function saveFileContent() {
        activateEditorSectionButton(fileContenSaveButton);

        let currentEditorFileContent = fileContentEditor.getValue();
        let currentSelectedFileNameKey = selectedEditorFileOption.firstElementChild.innerText.split('.').reverse().join('-');

        if (currentSelectedFileNameKey) {
            const storageRef = firebase.storage().ref(`${currentRoomUID}/${currentUserUID}/${currentSelectedFileNameKey}`);

            storageRef.putString(currentEditorFileContent).then(() => {
                currentUserFiles[currentSelectedFileNameKey] = currentEditorFileContent;
                // console.log(currentUserFiles);

                deactivateEditorSectionButton(fileContenSaveButton);
            })
                .catch((error) => {
                    console.error("Error updating file:", error);
                });
        }
    }

    async function runFileContent() {
        activateEditorSectionButton(fileContenRunButton);

        let currentEditorFileContent = fileContentEditor.getValue();

        let inputConsoleWindow = document.getElementById('file-input-window-textarea');
        let outputConsoleWindow = document.getElementById('file-output-window-textarea');

        const compileURL = "https://codelabs.website/compile";
        const compileOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                code: currentEditorFileContent,
                input: inputConsoleWindow.value,
                lang: fileContentEditorConfig.language
            })
        };

        try {
            let response = await fetch(compileURL, compileOptions);
            let result = await response.json();

            if (result.error) {
                outputConsoleWindow.innerText = result.error;
            } else {
                outputConsoleWindow.innerText = result.output;
            }

            deactivateEditorSectionButton(fileContenRunButton);
        } catch (error) {
            console.log("Failed to compile: " + error);

            outputConsoleWindow.innerText = "Failed to compile!";
            deactivateEditorSectionButton(fileContenRunButton);
        }
    }

    function downloadFileContent() {
        activateEditorSectionButton(fileContenDownloadButton);

        let currentSelectedFileName = selectedEditorFileOption.firstElementChild.innerText;
        let currentSelectedFileNameKey = currentSelectedFileName.split('.').reverse().join('-');

        let editorFileDownloadLink = document.getElementById('editor-file-download-link');

        let storageFileRef = firebase.storage().ref(`${currentRoomUID}/${currentUserUID}/${currentSelectedFileNameKey}`);

        storageFileRef.getDownloadURL().then((fileUrl) => {
            fetch(fileUrl)
                .then(response => response.blob())
                .then(fileBLOB => {
                    const fileBLOBUrl = window.URL.createObjectURL(fileBLOB);

                    editorFileDownloadLink.setAttribute('href', fileBLOBUrl);
                    editorFileDownloadLink.setAttribute('download', currentSelectedFileName);

                    editorFileDownloadLink.click();

                    editorFileDownloadLink.setAttribute('href', '#');
                    editorFileDownloadLink.setAttribute('download', '#');

                    deactivateEditorSectionButton(fileContenDownloadButton);
                }).catch((error) => {
                    console.log('Error reading file URL from storage:', error);
                    deactivateEditorSectionButton(fileContenDownloadButton);
                });
        }).catch((error) => {
            console.log('Error fetching file URL from storage:', error);
            deactivateEditorSectionButton(fileContenDownloadButton);
        });
    }

    function zoomInFileContent() {
        zoomLevel += 0.2;
        setEditorFontSize(baseFontSize * zoomLevel);
    }

    function zoomOutFileContent() {
        if (zoomLevel < 0.8) return;

        zoomLevel -= 0.2;
        setEditorFontSize(baseFontSize * zoomLevel);
    }
}

applyFileContentInteraction();

/* ///////////////////////////////////////////////////////////////////// */
/* file editor script */
/* ///////////////////////////////////////////////////////////////////// */

function setEditorFontSize(newFontSize) {
    fileContentEditor.updateOptions({ fontSize: newFontSize });
}

function setEditorLanguage(newLanguage) {
    fileContentEditorConfig.language = newLanguage;
    currentUserInfo.editorData = fileContentEditorConfig;

    let oldModel = fileContentEditor.getModel();
    if (oldModel) oldModel.dispose();

    let newModel = monaco.editor.createModel(fileContentEditor.getValue(), newLanguage);
    fileContentEditor.setModel(newModel);

    monaco.editor.setModelLanguage(newModel, newLanguage);

    yData.binding = new MonacoBinding(yData.type, fileContentEditor.getModel(), new Set([fileContentEditor]), yData.provider.awareness);
}

function setEditorContent(filename) {
    document.getElementById('file-name-text').innerText = filename;

    currentUserInfo.fileData = filename;

    let fileContent = getFileContent(filename);
    let fileLanguage = getFileLanguage(filename);

    if (fileContentEditorConfig.language != fileLanguage) setEditorLanguage(fileLanguage);

    fileContentEditor.getModel().setValue(fileContent);

    socket.emit('participant-editor-changed', currentUserInfo);
}

function getFileContent(filename) {
    let filekey = filename.split('.').reverse().join('-');
    return currentUserFiles[filekey];
}

function getFileLanguage(filename) {
    let fileext = filename.split('.')[1];
    return availableFileExtension[fileext];
}

function refreshEditor() {
    currentUserInfo.fileData = null;

    setEditorLanguage("plaintext");
    fileContentEditor.getModel().setValue("");

    socket.emit('participant-editor-changed', currentUserInfo);
}

function mountEditor() {
    document.getElementById('file-view').classList.remove('file-view-hidden');
    currentUserInfo.collabData.shareStatus = true;
}

function unmountEditor() {
    document.getElementById('file-view').classList.add('file-view-hidden');
    currentUserInfo.collabData.shareStatus = false;
}

/* ///////////////////////////////////////////////////////////////////// */
/* file tree content script */
/* ///////////////////////////////////////////////////////////////////// */

function generateEditorFileOption(fileKey) {
    let fileOptionName = fileKey.split("-", 2)[1] + "." + fileKey.split("-", 2)[0];

    let editorFileOptionButton = createEditorFileOptionButton(fileOptionName);

    addEditorFileOptionNode(editorFileOptionButton);
    addEditorFileOptionFunction(editorFileOptionButton);
}

function createEditorFileOptionButton(fileOptionName) {
    /*
    <li class="editor-file-option">
    <div class="editor-file-name">
    <span>${fileOptionName}</span>
    </div>
    <div class="editor-file-rename-input-container editor-file-name-control-hide">
    <input autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="text" class="editor-file-rename-input">
    </div>
    <div class="editor-file-option-util">
    <div class="editor-file-option-util-icon rename-file-button">
    <i class="fa-solid fa-pen-to-square"></i>
    </div>
    <div class="editor-file-option-util-icon delete-file-button">
    <i class="fa-solid fa-trash-can"></i>
    </div>
    </div>
    </li>
    */

    let i1 = document.createElement('i');
    i1.classList.add('fa-solid', 'fa-pen-to-square');

    let i2 = document.createElement('i');
    i2.classList.add('fa-solid', 'fa-trash-can');

    let div1 = document.createElement('div');
    div1.classList.add('editor-file-option-util-icon', 'rename-file-button');

    div1.append(i1);

    let div2 = document.createElement('div');
    div2.classList.add('editor-file-option-util-icon', 'delete-file-button');

    div2.append(i2);

    let div3 = document.createElement('div');
    div3.classList.add('editor-file-option-util');

    div3.append(div1, div2);

    let input1 = document.createElement('input');

    input1.setAttribute('autocomplete', 'off');
    input1.setAttribute('autocorrect', 'off');
    input1.setAttribute('autocapitalize', 'off');
    input1.setAttribute('spellcheck', 'false');
    input1.setAttribute('type', 'text');

    input1.classList.add('editor-file-rename-input');

    let div4 = document.createElement('div');
    div4.classList.add('editor-file-rename-input-container', 'editor-file-name-control-hide');

    div4.append(input1);

    let span1 = document.createElement('span');
    span1.innerText = fileOptionName;

    let div5 = document.createElement('div');
    div5.classList.add('editor-file-name');

    div5.append(span1);

    let li1 = document.createElement('li');
    li1.classList.add('editor-file-option');

    li1.append(div5, div4, div3);

    return li1;
}

function addEditorFileOptionNode(editorFileOptionElement) {
    document.getElementById('file-tree-list').append(editorFileOptionElement);
}

function addEditorFileOptionFunction(editorFileOptionElement) {
    setEditorFileOptionSelectFunction(editorFileOptionElement);

    setEditorFileOptionRenameFunction(editorFileOptionElement);
    setEditorFileOptionDeleteFunction(editorFileOptionElement);
}

function setEditorFileOptionSelectFunction(editorFileOptionElement) {
    let editorFileOptionNameContainerElement = editorFileOptionElement.firstElementChild;
    let editorFileOptionNameElement = editorFileOptionNameContainerElement.firstElementChild;

    editorFileOptionNameContainerElement.onclick = (e) => {
        if (selectedEditorFileOption === null) {
            mountEditor();
        } else {
            removeSelectionFromEditorFileOption(selectedEditorFileOption);
        }

        if (selectedEditorFileOption === editorFileOptionElement) {
            unmountEditor();
            refreshEditor();

            selectedEditorFileOption = null;
        } else {
            selectedEditorFileOption = editorFileOptionElement;

            setEditorContent(editorFileOptionNameElement.innerText);

            appplySelectionToEditorFileOption(selectedEditorFileOption);
        }
    }

    function removeSelectionFromEditorFileOption(fileOptionElement) {
        fileOptionElement.classList.remove('selected-editor-file-option');
    }

    function appplySelectionToEditorFileOption(fileOptionElement) {
        fileOptionElement.classList.add('selected-editor-file-option');
    }
}

function setEditorFileOptionRenameFunction(editorFileOptionElement) {
    let editorFileOptionNameContainerElement = editorFileOptionElement.firstElementChild;
    let editorFileOptionNameElement = editorFileOptionNameContainerElement.firstElementChild;

    let editorFileOptionNameInputContainerElement = editorFileOptionNameContainerElement.nextElementSibling;
    let editorFileOptionNameInputElement = editorFileOptionNameInputContainerElement.firstElementChild;

    let editorFileOptionRenameButton = editorFileOptionElement.lastElementChild.firstElementChild;
    let editorFileOptionRenameButtonIcon = editorFileOptionRenameButton.firstElementChild;

    editorFileOptionRenameButton.onclick = (e) => {
        startRenameFunction();

        document.addEventListener('mousedown', cancelRenameFile);
        document.addEventListener('keydown', confirmRenameFile);
    }

    function startRenameFunction() {
        editorFileOptionRenameButton.classList.add('editor-file-option-util-icon-active');
        editorFileOptionRenameButtonIcon.classList.add('fa-fade');

        editorFileOptionNameContainerElement.classList.add('editor-file-name-control-hide');
        editorFileOptionNameInputContainerElement.classList.remove('editor-file-name-control-hide');

        editorFileOptionNameInputElement.value = editorFileOptionNameElement.innerText;

        editorFileOptionNameInputElement.focus();
    }

    function endRenameFunction() {
        editorFileOptionRenameButton.classList.remove('editor-file-option-util-icon-active');
        editorFileOptionRenameButtonIcon.classList.remove('fa-fade');

        editorFileOptionNameContainerElement.classList.remove('editor-file-name-control-hide');
        editorFileOptionNameInputContainerElement.classList.add('editor-file-name-control-hide');
    }

    function confirmRenameFile(e) {
        if (e.key === 'Enter') {
            let renameFileInput = editorFileOptionNameInputElement.value;

            if (renameFileInput.trim() == "") return;

            let lastDotIndex = renameFileInput.lastIndexOf('.');
            let newfileName = renameFileInput;
            let newfileExtension = "";

            if (lastDotIndex !== -1) {
                newfileExtension = renameFileInput.substring(lastDotIndex + 1);

                console.log(newfileExtension);

                if (availableFileExtension[newfileExtension]) {
                    newfileName = renameFileInput.substring(0, lastDotIndex);
                }
                else {
                    alert("Wrong extension entered!");
                }
            } else {
                newfileExtension = "txt";
            }

            const invalidCharsRegex = /[.#$\[\]]/;

            if (newfileName && newfileName.trim() !== "" && !invalidCharsRegex.test(newfileName)) {

                const fileNameDotEXT = editorFileOptionNameElement.innerText;

                const EXTDashnewfileName = `${newfileExtension}-${newfileName}`;
                const EXTDashOldfileName = fileNameDotEXT.split('.').reverse().join('-');

                const oldPath_EXTDash = `${currentRoomUID}/${currentUserUID}/${EXTDashOldfileName}`;
                const newPath_EXTDash = `${currentRoomUID}/${currentUserUID}/${EXTDashnewfileName}`;

                const storageRefOld = firebase.storage().ref(oldPath_EXTDash);
                const storageRefNew = firebase.storage().ref(newPath_EXTDash);
                const fileRefOld = firebase.database().ref(`files/${oldPath_EXTDash}`);
                const fileRefNew = firebase.database().ref(`files/${newPath_EXTDash}`);

                storageRefOld.getDownloadURL().then(url => {
                    fetch(url)
                        .then(response => response.text())
                        .then(data => {
                            storageRefNew.putString(data).then(() => {
                                storageRefOld.delete().then(() => {
                                    fileRefOld.remove().then(() => {
                                        fileRefNew.set(storageRefNew.fullPath);

                                        const contentsOfRenamedFile = currentUserFiles[EXTDashOldfileName];
                                        delete currentUserFiles[EXTDashOldfileName];

                                        currentUserFiles[EXTDashnewfileName] = contentsOfRenamedFile;
                                        editorFileOptionNameElement.innerText = EXTDashnewfileName.split("-", 2)[1] + "." + EXTDashnewfileName.split("-", 2)[0];

                                        if (selectedEditorFileOption === editorFileOptionElement) {
                                            setEditorContent(editorFileOptionNameElement.innerText);
                                        }

                                        cancelRenameFile();
                                    }).catch((error) => {
                                        console.error("Error removing old file reference:", error);
                                    });
                                }).catch((error) => {
                                    console.error("Error deleting old file from Storage:", error);
                                });
                            }).catch((error) => {
                                console.error("Error renaming file in Storage:", error);
                            });
                        })
                        .catch(error => {
                            console.error("Error fetching file content:", error);
                        });
                });

            } else {
                alert("Please enter a valid file name without '.', '#', '$', '[', or ']'.");
            }
        }
    }

    function showRenameFileError() {
        // TODO: show error
    }

    function cancelRenameFile() {
        document.removeEventListener('mousedown', cancelRenameFile);
        document.removeEventListener('keydown', confirmRenameFile);

        endRenameFunction();
    }
}

function setEditorFileOptionDeleteFunction(editorFileOptionElement) {
    let editorFileOptionDeleteButton = editorFileOptionElement.lastElementChild.lastElementChild;
    let editorFileOptionDeleteButtonIcon = editorFileOptionDeleteButton.firstElementChild;

    let editorFileOptionNameElement = editorFileOptionElement.firstElementChild.firstElementChild;

    editorFileOptionDeleteButton.onclick = () => {
        startDeleteFunction();
        promptDeleteFile();
    }

    function startDeleteFunction() {
        editorFileOptionDeleteButton.classList.add('editor-file-option-util-icon-active');
        editorFileOptionDeleteButtonIcon.classList.add('fa-fade');
    }

    function endDeleteFunction() {
        editorFileOptionDeleteButton.classList.remove('editor-file-option-util-icon-active');
        editorFileOptionDeleteButtonIcon.classList.remove('fa-fade');
    }

    function promptDeleteFile() {
        const fileNameDotEXT = editorFileOptionNameElement.innerText;
        const confirmation = confirm("Are you sure you want to delete this file (" + fileNameDotEXT + ") ?");

        if (confirmation) {
            const EXTDashFileName = fileNameDotEXT.split('.').reverse().join('-');
            const filePath_EXTDash = `${currentRoomUID}/${currentUserUID}/${EXTDashFileName}`;

            const storageRef = firebase.storage().ref(filePath_EXTDash);
            const fileRef = firebase.database().ref(`files/${filePath_EXTDash}`);

            storageRef.delete().then(() => {
                fileRef.remove().then(() => {
                    if (selectedEditorFileOption === editorFileOptionElement) {
                        unmountEditor();
                        refreshEditor();

                        selectedEditorFileOption = null;
                    }

                    delete currentUserFiles[EXTDashFileName];

                    editorFileOptionElement.remove();
                }).catch((error) => {
                    console.error("Error removing file reference from Realtime Database:", error);
                    endDeleteFunction();
                });
            }).catch((error) => {
                console.error("Error deleting file from Storage:", error);
                endDeleteFunction();
            });
        } else {
            endDeleteFunction();
        }
    }

    function showDeleteFileError() {
        // TODO: show error
    }
}
