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
    sharingTo: null,

    userId: null,
    userName: null,
    displayName: null,
    email: null,
    role: null,
    imageUrl: null,

    roomId: null,

    consoleData: null
};

let participantList = {};

let selectedParticipantOption = null;

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
            currentUserInfo.role = "observer";

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
            deployRoomConnectivity();
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
                let roomCreatorId = snapshot.val().creatorUserid;

                if (roomCreatorId === currentUserUID) {
                    // history.replaceState({}, document.title, window.location.pathname + `/${currentRoomUID}`);

                    let currentRoomName = snapshot.val().roomname;

                    firebase
                        .database()
                        .ref("users/" + currentUserUID + "/createdRooms")
                        .get()
                        .then((snapshot) => {
                            let userCreatedRooms = snapshot.val();

                            if (Object.values(userCreatedRooms).includes(`${currentRoomName}#${currentRoomType}#${currentRoomUID}`)) {
                                
                                let roomNameText = document.getElementById('room-name-text');
                                roomNameText.innerText = currentRoomName;
                            
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

//deploying room connections
function deployRoomConnectivity() {
    let videconPlatform = document.getElementById('videocon-iframe');
    videconPlatform.setAttribute('src', `/videocon?roomID=${currentRoomUID}&userID=${currentUserInfo.userId}&userName=${currentUserInfo.displayName}`);

    currentUserInfo.connectionId = socket.id;

    socket.emit('setup-peer-connection', currentUserInfo);

    socket.on('provide-peer-config', () => {
        socket.emit('setup-peer-connection', currentUserInfo);
    });

    socket.on('add-participants', (participantsInfo) => {
        participantsInfo.forEach((participantInfo) => {
            updateParticipantList('add', participantInfo);
        });
    });

    socket.on('add-participant', (participantInfo) => {
        updateParticipantList('add', participantInfo);
    });

    socket.on('remove-participant', (participantInfo) => {
        updateParticipantList('remove', participantInfo);
    });

    socket.on('change-editor', (participantInfo) => {
        updateParticipantInfo(participantInfo);
    });

    socket.on('accept-input', (participantInfo) => {
        if (selectedParticipantOption === null || selectedParticipantOption.id !== participantInfo.userId) return;

        alert(`Your participant, ${participantInfo.displayName}, has shared an input example.`);

        let inputConsoleWindow = document.getElementById('file-input-window-textarea');
        inputConsoleWindow.value += `// Your participant's input example\n${participantInfo.consoleData}`;
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
        currentUserInfo.sharingTo = participantList[selectedParticipantOption.id].connectionId;

        socket.emit('observer-input-shared', currentUserInfo);
    };
}

applyFileConsoleInteraction();

/* ///////////////////////////////////////////////////////////////////// */
/* file content script */
/* ///////////////////////////////////////////////////////////////////// */

function applyFileContentInteraction() {
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

                    fileContenRunButton.addEventListener('click', runFileContent);
                    fileContenDownloadButton.addEventListener('click', downloadFileContent);

                    fileContentZoomInButton.addEventListener('click', zoomInFileContent);
                    fileContentZoomOutButton.addEventListener('click', zoomOutFileContent);
                });
        }
    });

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

        let currentSelectedParticipantUID = participantList[selectedParticipantOption.id].userId;

        let currentSelectedFileName = participantList[selectedParticipantOption.id].fileData;
        let currentSelectedFileNameKey = currentSelectedFileName.split('.').reverse().join('-');

        let editorFileDownloadLink = document.getElementById('editor-file-download-link');

        let storageFileRef = firebase.storage().ref(`${currentRoomUID}/${currentSelectedParticipantUID}/${currentSelectedFileNameKey}`);

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
/* participant editor script */
/* ///////////////////////////////////////////////////////////////////// */

function setEditorFontSize(newFontSize) {
    fileContentEditor.updateOptions({ fontSize: newFontSize });
}

function setEditorLanguage(newLanguage) {
    fileContentEditorConfig.language = newLanguage;

    let oldModel = fileContentEditor.getModel();
    if (oldModel) oldModel.dispose();

    let newModel = monaco.editor.createModel(fileContentEditor.getValue(), newLanguage);
    fileContentEditor.setModel(newModel);

    monaco.editor.setModelLanguage(newModel, newLanguage);
}

function setEditorContent(participantId) {
    let fileName = participantList[participantId].fileData;
    let fileLanguage = participantList[participantId].editorData.language;

    document.getElementById('file-name-text').innerText = fileName;

    setEditorLanguage(fileLanguage);

    participantList[participantId].yData.binding = new MonacoBinding(participantList[participantId].yData.type, fileContentEditor.getModel(), new Set([fileContentEditor]), participantList[participantId].yData.provider.awareness);
}

function destroyEditorContent() {
    participantList[selectedParticipantOption.id].yData.binding.destroy();
}

function changeEditorContent(participantId) {
    destroyEditorContent();
    setEditorContent(participantId);
}

function mountEditor() {
    document.getElementById('file-view').classList.remove('file-view-hidden');
}

function unmountEditor() {
    document.getElementById('file-view').classList.add('file-view-hidden');
}

/* ///////////////////////////////////////////////////////////////////// */
/* participant tree content script */
/* ///////////////////////////////////////////////////////////////////// */

function updateParticipantList(commandType, participantInfo) {
    if (commandType === 'add') {
        if (participantList[participantInfo.userId] !== undefined) return;

        console.log('Adding participant', participantInfo);

        addParticipantInfo(participantInfo);
        generateEditorParticipantOption(participantInfo);
    } else if (commandType === 'remove') {
        if (participantList[participantInfo.userId] === undefined) return;

        console.log('Removing participant', participantInfo);

        destroyEditorParticipantOption(participantInfo);
        removeParticipantInfo(participantInfo);
    }
}

function addParticipantInfo(participantInfo) {
    let ydoc = new Y.Doc();
    let type = ydoc.getText('monaco');
    let provider = new WebrtcProvider(participantInfo.collabData.shareTag, ydoc, { signaling: participantInfo.collabData.signalingServerList });
    let binding = null;

    participantInfo.yData = { ydoc, type, provider, binding };

    participantList[participantInfo.userId] = participantInfo;
}

function removeParticipantInfo(participantInfo) {
    participantList[participantInfo.userId].yData.ydoc.destroy();

    delete participantList[participantInfo.userId];
}

function updateParticipantInfo(participantInfo) {
    if (participantList[participantInfo.userId] === undefined) return;

    if (!participantInfo.collabData.shareStatus) {
        if (selectedParticipantOption != null && selectedParticipantOption.id === participantInfo.userId && participantList[participantInfo.userId].collabData.shareStatus) {
            selectedParticipantOption.classList.remove('selected-editor-participant-option');

            unmountEditor();
            destroyEditorContent();

            selectedParticipantOption = null;
        }

        if (participantList[participantInfo.userId].collabData.shareStatus) {
            document.getElementById(participantInfo.userId).classList.add('editor-participant-option-unavailable');
        }

        participantList[participantInfo.userId].fileData = participantInfo.fileData;
        participantList[participantInfo.userId].editorData = participantInfo.editorData;
        participantList[participantInfo.userId].collabData.shareStatus = participantInfo.collabData.shareStatus;
    } else {
        if (!participantList[participantInfo.userId].collabData.shareStatus) {
            document.getElementById(participantInfo.userId).classList.remove('editor-participant-option-unavailable');
        }

        participantList[participantInfo.userId].fileData = participantInfo.fileData;
        participantList[participantInfo.userId].editorData = participantInfo.editorData;
        participantList[participantInfo.userId].collabData.shareStatus = participantInfo.collabData.shareStatus;

        if (selectedParticipantOption != null && selectedParticipantOption.id === participantInfo.userId && participantList[participantInfo.userId].collabData.shareStatus) {
            changeEditorContent(participantInfo.userId);
        }
    }
}

function generateEditorParticipantOption(participantInfo) {
    let editorParticipantOptionButton = createEditorParticipantOptionButton(participantInfo);

    addEditorParticipantOptionNode(editorParticipantOptionButton);
    addEditorParticipantOptionFunction(editorParticipantOptionButton);
}

function destroyEditorParticipantOption(participantInfo) {
    let targetParticipantOption = document.getElementById(participantInfo.userId);

    if (targetParticipantOption === selectedParticipantOption) {
        unmountEditor();

        destroyEditorContent();

        selectedParticipantOption = null;
    }

    targetParticipantOption.remove();
}

function createEditorParticipantOptionButton(participantInfo) {
    /*
    <li id="${participantInfo.userId}" class="editor-participant-option">
        <img class="editor-participant-image" src="${participantInfo.imageUrl}" alt="image">
        <div class="editor-participant-name"><span>${participantInfo.displayName}</span></div>
        <div class="editor-participant-status"><i class="fa-solid fa-wifi"></i></div>
    </li>
    */

    let img1 = document.createElement('img');
    img1.classList.add('editor-participant-image');

    img1.setAttribute('src', participantInfo.imageUrl);
    img1.setAttribute('alt', 'image');

    let span1 = document.createElement('span');
    span1.innerText = participantInfo.displayName;

    let div1 = document.createElement('div');
    div1.classList.add('editor-participant-name');

    div1.append(span1);

    let i1 = document.createElement('i');
    i1.classList.add('fa-solid', 'fa-wifi');

    let div2 = document.createElement('div');
    div2.classList.add('editor-participant-status');

    div2.append(i1);

    let li1 = document.createElement('li');
    li1.classList.add('editor-participant-option');

    if (!participantInfo.collabData.shareStatus) {
        li1.classList.add('editor-participant-option-unavailable');
    }

    li1.id = participantInfo.userId;

    li1.append(img1, div1, div2);

    return li1;
}

function addEditorParticipantOptionNode(editorParticipantOptionElement) {
    document.getElementById('participant-tree-list').append(editorParticipantOptionElement);
}

function addEditorParticipantOptionFunction(editorParticipantOptionElement) {
    setEditorParticipantOptionSelectFunction(editorParticipantOptionElement);
}

function setEditorParticipantOptionSelectFunction(editorParticipantOptionElement) {
    editorParticipantOptionElement.onclick = (e) => {
        if (selectedParticipantOption === null) {
            mountEditor();

            setEditorContent(editorParticipantOptionElement.id);

            selectedParticipantOption = editorParticipantOptionElement;

            applySelectionFromEditorParticipantOption(selectedParticipantOption);
        } else if (selectedParticipantOption === editorParticipantOptionElement) {
            removeSelectionFromEditorParticipantOption(selectedParticipantOption);

            unmountEditor();

            destroyEditorContent();

            selectedParticipantOption = null;
        } else {
            removeSelectionFromEditorParticipantOption(selectedParticipantOption);

            changeEditorContent(editorParticipantOptionElement.id);

            selectedParticipantOption = editorParticipantOptionElement;

            applySelectionFromEditorParticipantOption(selectedParticipantOption);
        }
    }

    function removeSelectionFromEditorParticipantOption(participantOptionElement) {
        participantOptionElement.classList.remove('selected-editor-participant-option');
    }

    function applySelectionFromEditorParticipantOption(participantOptionElement) {
        participantOptionElement.classList.add('selected-editor-participant-option');
    }
}

/* ///////////////////////////////////////////////////////////////////// */
/* videocon script */
/* ///////////////////////////////////////////////////////////////////// */

