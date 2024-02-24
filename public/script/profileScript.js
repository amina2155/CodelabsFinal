const database = firebase.database();

//When a user is logged in
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        displayUserInfo(user);
    } else {
        window.location.href = "/login";
    }
});

var currentUserUID;
let allowNewNotification = false;

const currentUserInfo = {
    uid: null,
    room: {
        created: [],
        joined: [],
        keylist: []
    }
};

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
            console.log("Username:", username_now);
            currentUserUID = firebase.auth().currentUser.uid;

            fullname.innerHTML = `${user.displayName}`;
            emailid.innerHTML = `${user.email}`;
            if (user.photoURL == null) {
                profilepicture.src = `${"/image/download.png"}`;
                profileicon.src = `${"/image/download.png"}`;
            } else {
                profilepicture.src = `${user.photoURL}`;
                profileicon.src = `${user.photoURL}`;
            }

            collectUserNotification();
            collectRoomInfo();
        })
        .catch((error) => {
            console.error("Error fetching username:", error);
            window.location.hre = "/error";
        });
}

//User notifications is collected
function collectUserNotification() {
    const notificationRef = firebase.database().ref(`users/${currentUserUID}/notifications`);

    let initialNotificationCount = 0;
    const notificationIcon = document.getElementById('notification-icon');

    notificationRef.once('value', (snapshot) => {
        const notifications = snapshot.val();
        initialNotificationCount = notifications ? Object.keys(notifications).length : 0;
    });

    notificationRef.on('value', (snapshot) => {
        const notifications = snapshot.val();
        console.log(notifications);
        const notificationPopup = document.getElementById('notification-popup');

        notificationPopup.innerHTML = '';

        if (notifications) {
            if (allowNewNotification) {
                Object.keys(notifications).forEach(notificationKey => {
                    let roomCardElement = document.querySelector(`#joined-room-collection .room-collection .room-id${notificationKey}`);
                    console.log(notificationKey, roomCardElement);
                    if (roomCardElement) {
                        roomCardElement.remove();
                    }
                });
            }

            const sortedNotifications = Object.values(notifications).sort((a, b) => {
                return b.timestamp - a.timestamp;
            });

            sortedNotifications.forEach((notification) => {
                console.log(notification.message)
                const paragraph = document.createElement('p');

                const time = notification.timestamp;
                const timeAndDate = new Date(time);
                const formatted = timeAndDate.toLocaleString();

                paragraph.textContent = `${notification.message} - ${formatted}`;
                notificationPopup.appendChild(paragraph);

                const newNotificationCount = Object.keys(notifications).length;

                if (newNotificationCount > initialNotificationCount) {
                    if (allowNewNotification) {
                        notificationIcon.classList.add('new-notification-arrived');
                    } else {
                        allowNewNotification = true;
                    }
                    
                    console.log('New notifications arrived!');
                }
        
                initialNotificationCount = newNotificationCount;
            });
        } else {
            const noMessagesParagraph = document.createElement('p');
            noMessagesParagraph.textContent = 'No messages for you.';
            notificationPopup.appendChild(noMessagesParagraph);
        }
    });
}

//User room info is collected
function collectRoomInfo() {
    currentUserInfo.uid = currentUserUID;

    firebase
        .database()
        .ref("users/" + currentUserInfo.uid)
        .get()
        .then((snapshot) => {
            let userCompleteInfo = snapshot.val();

            console.log(userCompleteInfo.createdRooms);
            console.log(userCompleteInfo.joinedRooms);

            if (userCompleteInfo.createdRooms != undefined) {
                Object.values(userCompleteInfo.createdRooms).forEach((eachCRI, eachCRIidx) => {
                    let tempCRIA = eachCRI.split("#", 3);

                    currentUserInfo.room.created.push({ name: tempCRIA[0], type: tempCRIA[1], key: tempCRIA[2] });
                    currentUserInfo.room.keylist.push(tempCRIA[2]);

                    generateRoomCard(tempCRIA[0], tempCRIA[1], tempCRIA[2], eachCRIidx, "created");
                });
            }

            if (userCompleteInfo.joinedRooms != undefined) {
                Object.values(userCompleteInfo.joinedRooms).forEach((eachJRI, eachJRIidx) => {
                    let tempCRIA = eachJRI.split("#", 3);

                    currentUserInfo.room.joined.push({ name: tempCRIA[0], type: tempCRIA[1], key: tempCRIA[2] });
                    currentUserInfo.room.keylist.push(tempCRIA[2]);

                    generateRoomCard(tempCRIA[0], tempCRIA[1], tempCRIA[2], eachJRIidx, "joined");
                });
            }

            console.log("Created Rooms: ");
            console.log(currentUserInfo.room.created);

            console.log("Joined Rooms: ");
            console.log(currentUserInfo.room.joined);

            console.log("Key List: ");
            console.log(currentUserInfo.room.keylist);
        })
        .catch((error) => {
            console.error("Error fetching room info:", error);
            window.location.href = "/error";
        });
}

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
        openNotificationPopup();
    }
}

function openNotificationPopup() {
    if (notificationIcon.classList.contains("new-notification-arrived")) {
        notificationIcon.classList.remove('new-notification-arrived');
    }

    notificationPopup.style.display = "block";
    notificationIcon.classList.add('notification-icon-active');
}

function closeNotificationPopup() {
    notificationPopup.style.display = "none";
    notificationIcon.classList.remove('notification-icon-active');
}

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
const changeProfilePictureBtn = document.getElementById(
    "change-profile-picture"
);
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
    const currentPhotoURL = (currentUser ? currentUser.photoURL : null);

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
const profilePictureInput = document.getElementById("profile-picture-input");

document
    .getElementById("change-profile-picture")
    .addEventListener("click", () => {
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

////////////////////////////////////////////////////////////////////////
//Room Configure Scripts
////////////////////////////////////////////////////////////////////////

function applyRoomConfigureInteraction() {
    let configRoomButton = document.getElementById("plus-icon-container");

    let createRoomButton = document.getElementById("create-room-option");
    let joinRoomButton = document.getElementById("join-room-option");

    let configPopupCloseButton = document.getElementById(
        "config-popup-close-button"
    );

    let createRoomConfigCancelButton = document.getElementById(
        "create-room-config-cancel-button"
    );
    let createRoomConfigCreateButton = document.getElementById(
        "create-room-config-create-button"
    );

    let joinRoomConfigCancelButton = document.getElementById(
        "join-room-config-cancel-button"
    );
    let joinRoomConfigJoinButton = document.getElementById(
        "join-room-config-join-button"
    );

    configRoomButton.onclick = (e) => {
        applyPopupOverlay();
        openRoomConfigPopup("base");
    };

    configPopupCloseButton.onclick = (e) => {
        closeRoomConfigPopup("base");
        removePopupOverlay();
    };

    createRoomButton.onclick = (e) => {
        closeRoomConfigPopup("base");
        openRoomConfigPopup("create");
    };

    joinRoomButton.onclick = (e) => {
        closeRoomConfigPopup("base");
        openRoomConfigPopup("join");
    };

    createRoomConfigCancelButton.onclick = (e) => {
        clearRoomConfigInput("create");
        closeRoomConfigPopup("create");
        removePopupOverlay();
    };

    joinRoomConfigCancelButton.onclick = (e) => {
        clearRoomConfigInput("join");
        closeRoomConfigPopup("join");
        removePopupOverlay();
    };

    createRoomConfigCreateButton.onclick = (e) => {
        let roomname = document.getElementById("room-name-input").value;
        let roomtype = document.getElementById("room-type-input").value;

        startRoomConfigProcess("create");

        let roomindex;

        //Creating a new room into rooms folder of database

        const roomKey = database.ref("rooms").push().key;

        let roomData = {
            roomname: roomname,
            roomtype: roomtype,
            status: false,
            creatorUserid: currentUserUID,
            numberOfParticipants: 0,
        };

        let updates = {};
        updates["/rooms/" + roomKey] = roomData;

        database.ref().update(updates);

        database
            .ref("rooms/" + roomKey)
            .child("participants")
            .set(null);

        //Storing the room id under the user's information in database

        let numberOfCreatedRoomsInUSER;

        database
            .ref("users/" + firebase.auth().currentUser.uid + "/numberOfCreatedRooms")
            .get()
            .then((snapshot) => {
                numberOfCreatedRoomsInUSER = snapshot.val();

                //new room increases the count
                numberOfCreatedRoomsInUSER = numberOfCreatedRoomsInUSER + 1;

                let modifiedRoomKey = roomname + "#" + roomtype + "#" + roomKey;

                database
                    .ref("users/" + currentUserUID)
                    .child("createdRooms")
                    .update({
                        [numberOfCreatedRoomsInUSER]: modifiedRoomKey,
                    });

                //save the increased count in the database
                database.ref("users/" + currentUserUID).update({
                    numberOfCreatedRooms: numberOfCreatedRoomsInUSER,
                });

                roomindex = numberOfCreatedRoomsInUSER;

                console.log(
                    `Room Index : ${roomindex} Room Name : ${roomname} Room Type : ${roomtype} Room Key : ${roomKey}`
                );

                currentUserInfo.room.joined.push({ name: roomname, type: roomtype, key: roomKey });
                currentUserInfo.room.keylist.push(roomKey);

                setTimeout(() => {
                    generateRoomCard(roomname, roomtype, roomKey, roomindex, "created");

                    endRoomConfigProcess("create");

                    clearRoomConfigInput("create");
                    closeRoomConfigPopup("create");
                    removePopupOverlay();
                }, 2000);
            });
    };

    joinRoomConfigJoinButton.onclick = (e) => {
        let joiningRoomKey = document.getElementById("room-code-input").value;

        startRoomConfigProcess("join");

        let numberOfJoinedRoomsInUser, joiningroomindex, numberOfParticipantsInRoomNow, joiningRoomName, joiningRoomType;

        //In this function I am adding the joininng participant in participant list
        //of the particular room key it is providing
        database
            .ref("rooms/" + joiningRoomKey + "/numberOfParticipants")
            .once("value")
            .then((snapshot) => {
                numberOfParticipantsInRoomNow = snapshot.val();

                //new participant increases the count
                numberOfParticipantsInRoomNow = numberOfParticipantsInRoomNow + 1;

                database
                    .ref("rooms/" + joiningRoomKey)
                    .child("participants")
                    .update({
                        [numberOfParticipantsInRoomNow]: currentUserUID,
                    });

                //save the increased count in the database
                database.ref("rooms/" + joiningRoomKey).update({
                    numberOfParticipants: numberOfParticipantsInRoomNow,
                });

                //In this function, I am adding a room key under a user's joined room folder in database
                //So that user can see which rooms he has joined
                database
                    .ref(
                        "users/" + firebase.auth().currentUser.uid + "/numberOfJoinedRooms"
                    )
                    .once("value")
                    .then((snapshot) => {
                        numberOfJoinedRoomsInUser = snapshot.val();

                        //new room increases the count
                        numberOfJoinedRoomsInUser = numberOfJoinedRoomsInUser + 1;

                        joiningroomindex = numberOfJoinedRoomsInUser;

                        //save the increased count in the database
                        database.ref("users/" + currentUserUID).update({
                            numberOfJoinedRooms: numberOfJoinedRoomsInUser,
                        });

                        //Synchronously collecting roomtype and
                        //saving the room key with type in user database
                        database
                            .ref("rooms/" + joiningRoomKey)
                            .once("value")
                            .then((snapshot) => {
                                joiningRoomName = snapshot.val().roomname;
                                joiningRoomType = snapshot.val().roomtype;

                                let joiningRoomCreatorUID = snapshot.val().creatorUserid;

                                let modifiedJoiningRoomKey = joiningRoomName + "#" + joiningRoomType + "#" + joiningRoomKey;

                                database
                                    .ref("users/" + currentUserUID)
                                    .child("joinedRooms")
                                    .update({
                                        [numberOfJoinedRoomsInUser]: modifiedJoiningRoomKey,
                                    });

                                console.log(
                                    `Room Index : ${joiningroomindex} Room Name : ${joiningRoomName} Room Type : ${joiningRoomType} Room Key : ${joiningRoomKey}`
                                );

                                currentUserInfo.room.joined.push({ name: joiningRoomName, type: joiningRoomType, key: joiningRoomKey });
                                currentUserInfo.room.keylist.push(joiningRoomKey);

                                firebase.database().ref(`/users/${joiningRoomCreatorUID}/notifications`).push({
                                    message: `${document.getElementById("full-name-id").innerHTML} joined your room, ${joiningRoomName}`,
                                    timestamp: firebase.database.ServerValue.TIMESTAMP
                                });

                                setTimeout(() => {
                                    generateRoomCard(joiningRoomName, joiningRoomType, joiningRoomKey, joiningroomindex, "joined");

                                    endRoomConfigProcess("join");

                                    clearRoomConfigInput("join");
                                    closeRoomConfigPopup("join");
                                    removePopupOverlay();
                                }, 2000);
                            });
                    });
            });
    };

    let createRoomNameInput = document.getElementById("room-name-input");
    let joinRoomCodeInput = document.getElementById("room-code-input");

    let inputValidationTimeout, inputValidated = true;

    createRoomNameInput.oninput = (e) => {
        inputValidated = (createRoomNameInput.value ? true : false);

        if (inputValidated) {
            hideRoomConfigInputError("create");
            accessRoomConfigOption("create");
        } else {
            showRoomConfigInputError("create");
            restrictRoomConfigOption("create");
        }
    };

    joinRoomCodeInput.oninput = (e) => {
        hideRoomConfigInputError("join");
        restrictRoomConfigOption("join");

        if (inputValidationTimeout != undefined) clearTimeout(inputValidationTimeout);

        inputValidationTimeout = setTimeout(() => {
            validateRoomCodeInput();
        }, 500);
    };

    function validateRoomCodeInput() {
        let joinRoomCodeInputData = joinRoomCodeInput.value;

        console.log(joinRoomCodeInputData);

        if (joinRoomCodeInputData === "") {
            console.log("No Room Code");

            inputValidated = undefined;
            applyValidation();

            return;
        }

        if (currentUserInfo.room.keylist.includes(joinRoomCodeInputData)) {
            console.log("Has Already Joined The Room");

            inputValidated = false;
            applyValidation();

            return;
        }

        database
            .ref("rooms/")
            .once("value")
            .then((snapshot) => {
                let roomCompleteInfo = snapshot.val();

                if (Object.keys(roomCompleteInfo).includes(joinRoomCodeInputData)) {
                    console.log("Room Available");
                    inputValidated = true;
                } else {
                    console.log("Not Found In Available Rooms");
                    inputValidated = false;
                }

                applyValidation();
            });
    }

    function applyValidation() {
        console.log("validation done!");

        if (inputValidated == undefined) return;

        if (inputValidated == true) {
            accessRoomConfigOption("join");
        } else {
            showRoomConfigInputError("join");
        }
    }

    function applyPopupOverlay() {
        //disabling the config room button
        configRoomButton.style.zIndex = -1;

        //disabling the room control menu
        let roomControlMenu = document.getElementById("room-control-menu");
        roomControlMenu.style.zIndex = -1;

        //apply overlay underneath popup window
        let popupOverlay = document.getElementById("popup-overlay");
        popupOverlay.style.display = "block";
    }

    function removePopupOverlay() {
        //enabling the config room button
        configRoomButton.style.zIndex = 1;

        //disabling the room control menu
        let roomControlMenu = document.getElementById("room-control-menu");
        roomControlMenu.style.zIndex = 1;

        //remove overlay underneath popup window
        let popupOverlay = document.getElementById("popup-overlay");
        popupOverlay.style.display = "none";
    }

    function openRoomConfigPopup(type) {
        if (type === "base") {
            //make the base config popup window visible
            let baseRoomConfigPopup = document.getElementById("room-config-popup");
            baseRoomConfigPopup.style.display = "flex";
        } else if (type === "create") {
            //make the create config popup window visible
            let createRoomConfigPopup = document.getElementById("create-room-popup");
            createRoomConfigPopup.style.display = "flex";
        } else if (type === "join") {
            //make the join config popup window visible
            let joinRoomConfigPopup = document.getElementById("join-room-popup");
            joinRoomConfigPopup.style.display = "flex";
        }
    }

    function closeRoomConfigPopup(type) {
        if (type === "base") {
            //make the base config popup window invisible
            let baseRoomConfigPopup = document.getElementById("room-config-popup");
            baseRoomConfigPopup.style.display = "none";
        } else if (type === "create") {
            //make the create config popup window invisible
            let createRoomConfigPopup = document.getElementById("create-room-popup");
            createRoomConfigPopup.style.display = "none";
        } else if (type === "join") {
            //make the join config popup window invisible
            let joinRoomConfigPopup = document.getElementById("join-room-popup");
            joinRoomConfigPopup.style.display = "none";
        }
    }

    function showRoomConfigInputError(type) {
        if (type === "create") {
            let createRoomNameInputError = document.getElementById("room-name-input-error");

            if (createRoomNameInputError.style.display != "block") {
                createRoomNameInputError.style.display = "block";
            }
        } else if (type === "join") {
            let joinRoomCodeInputError = document.getElementById("room-code-input-error");

            if (joinRoomCodeInputError.style.display != "block") {
                joinRoomCodeInputError.style.display = "block";
            }
        }
    }

    function hideRoomConfigInputError(type) {
        if (type === "create") {
            let createRoomNameInputError = document.getElementById("room-name-input-error");

            if (createRoomNameInputError.style.display != "none") {
                createRoomNameInputError.style.display = "none";
            }
        } else if (type === "join") {
            let joinRoomCodeInputError = document.getElementById("room-code-input-error");

            if (joinRoomCodeInputError.style.display != "none") {
                joinRoomCodeInputError.style.display = "none";
            }
        }
    }

    function clearRoomConfigInput(type) {
        if (inputValidationTimeout != undefined) {
            clearTimeout(inputValidationTimeout);
            inputValidationTimeout = undefined;
        }

        if (type === "create") {
            createRoomNameInput.value = "";

            hideRoomConfigInputError("create");
            restrictRoomConfigOption("create");
        } else if (type === "join") {
            joinRoomCodeInput.value = "";

            hideRoomConfigInputError("join");
            restrictRoomConfigOption("join");
        }
    }

    function accessRoomConfigOption(type) {
        if (type === "create") {
            if (createRoomConfigCreateButton.classList.contains("config-control-option-unavailable")) {
                createRoomConfigCreateButton.classList.remove("config-control-option-unavailable");
                createRoomConfigCreateButton.classList.add("config-control-option-available");
            }
        } else if (type === "join") {
            if (joinRoomConfigJoinButton.classList.contains("config-control-option-unavailable")) {
                joinRoomConfigJoinButton.classList.remove("config-control-option-unavailable");
                joinRoomConfigJoinButton.classList.add("config-control-option-available");
            }
        } else if (type === "create-cancel") {
            if (createRoomConfigCancelButton.classList.contains("config-control-option-unavailable")) {
                createRoomConfigCancelButton.classList.remove("config-control-option-unavailable");
                createRoomConfigCancelButton.classList.add("config-control-option-available");
            }
        } else if (type === "join-cancel") {
            if (joinRoomConfigCancelButton.classList.contains("config-control-option-unavailable")) {
                joinRoomConfigCancelButton.classList.remove("config-control-option-unavailable");
                joinRoomConfigCancelButton.classList.add("config-control-option-available");
            }
        }
    }

    function restrictRoomConfigOption(type) {
        if (type === "create") {
            if (createRoomConfigCreateButton.classList.contains("config-control-option-available")) {
                createRoomConfigCreateButton.classList.remove("config-control-option-available");
                createRoomConfigCreateButton.classList.add("config-control-option-unavailable");
            }
        } else if (type === "join") {
            if (joinRoomConfigJoinButton.classList.contains("config-control-option-available")) {
                joinRoomConfigJoinButton.classList.remove("config-control-option-available");
                joinRoomConfigJoinButton.classList.add("config-control-option-unavailable");
            }
        } else if (type === "create-cancel") {
            if (createRoomConfigCancelButton.classList.contains("config-control-option-available")) {
                createRoomConfigCancelButton.classList.remove("config-control-option-available");
                createRoomConfigCancelButton.classList.add("config-control-option-unavailable");
            }
        } else if (type === "join-cancel") {
            if (joinRoomConfigCancelButton.classList.contains("config-control-option-available")) {
                joinRoomConfigCancelButton.classList.remove("config-control-option-available");
                joinRoomConfigCancelButton.classList.add("config-control-option-unavailable");
            }
        }
    }

    function startRoomConfigProcess(type) {
        if (type === "create") {
            restrictRoomConfigOption("create-cancel");
            createRoomConfigCreateButton.classList.add("config-control-option-processing");
        } else if (type === "join") {
            restrictRoomConfigOption("join-cancel");
            joinRoomConfigJoinButton.classList.add("config-control-option-processing");
        }
    }

    function endRoomConfigProcess(type) {
        if (type === "create") {
            accessRoomConfigOption("create-cancel");
            createRoomConfigCreateButton.classList.remove("config-control-option-processing");
        } else if (type === "join") {
            accessRoomConfigOption("join-cancel");
            joinRoomConfigJoinButton.classList.remove("config-control-option-processing");
        }
    }
}

applyRoomConfigureInteraction();

////////////////////////////////////////////////////////////////////////
//Room Control Scripts
////////////////////////////////////////////////////////////////////////

function applyRoomControlInteraction() {
    let currentSelectedPageSectionIdx = 0;

    let roomControlMenuOptions = [
        ...document.getElementsByClassName("room-control-menu-option"),
    ];

    roomControlMenuOptions.forEach((rcOption, rcOptionIdx) => {
        rcOption.onclick = (e) => {
            if (currentSelectedPageSectionIdx === rcOptionIdx) return;

            hidePageSection(currentSelectedPageSectionIdx);

            currentSelectedPageSectionIdx = rcOptionIdx;

            showPageSection(currentSelectedPageSectionIdx);
        };
    });

    function showPageSection(pageSectionIdx) {
        if (pageSectionIdx === 0) {
            let createdRoomsSection = document.getElementById(
                "created-room-collection"
            );
            createdRoomsSection.style.display = "block";
        } else if (pageSectionIdx === 1) {
            let joinedRoomsSection = document.getElementById(
                "joined-room-collection"
            );
            joinedRoomsSection.style.display = "block";
        } else if (pageSectionIdx === 2) {
            let helpSection = document.getElementById("room-control-help");
            helpSection.style.display = "block";
        }

        selectControlMenuOption(pageSectionIdx);
    }

    function hidePageSection(pageSectionIdx) {
        if (pageSectionIdx === 0) {
            let createdRoomsSection = document.getElementById(
                "created-room-collection"
            );
            createdRoomsSection.style.display = "none";
        } else if (pageSectionIdx === 1) {
            let joinedRoomsSection = document.getElementById(
                "joined-room-collection"
            );
            joinedRoomsSection.style.display = "none";
        } else if (pageSectionIdx === 2) {
            let helpSection = document.getElementById("room-control-help");
            helpSection.style.display = "none";
        }

        deselectControlMenuOption(pageSectionIdx);
    }

    function selectControlMenuOption(optionIdx) {
        let controlMenuOption = [
            ...document.getElementsByClassName("room-control-menu-option"),
        ][optionIdx];
        controlMenuOption.classList.add("selected-room-control-menu-option");
    }

    function deselectControlMenuOption(optionIdx) {
        let controlMenuOption = [
            ...document.getElementsByClassName("room-control-menu-option"),
        ][optionIdx];
        controlMenuOption.classList.remove("selected-room-control-menu-option");
    }

    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    //Room Sort Scripts
    //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

    let roomSortControlTags = [...document.getElementsByClassName("room-sort-tag")];

    roomSortControlTags.forEach((sortTag) => {
        sortTag.onclick = (e) => {
            let currentPageSection = findPageSection(currentSelectedPageSectionIdx);
            let prevSelectedSortTag = document.querySelector(`#${currentPageSection.id} .room-sort-tag.selected-tag`);

            removeSortFromPageSection(currentPageSection, prevSelectedSortTag)
            applySortToPageSection(currentPageSection, sortTag);
        };
    });

    function findPageSection(pageSectionIdx) {
        if (pageSectionIdx === 0) {
            return document.getElementById("created-room-collection");
        } else if (pageSectionIdx === 1) {
            return document.getElementById("joined-room-collection");
        }
    }

    function removeSortFromPageSection(pageSection, removingSortTag) {
        removingSortTag.classList.remove("selected-tag");

        if (removingSortTag.classList.contains("all-tag")) return;

        let prevHiddenType = (removingSortTag.classList.contains("class-tag") ? "project" : "class");
        let prevHiddenRoomCards = [...pageSection.querySelectorAll(`.room-collection .room-card.room-type-${prevHiddenType}`)];

        prevHiddenRoomCards.forEach((roomCard) => {
            roomCard.classList.remove("room-card-hidden");
        });
    }

    function applySortToPageSection(pageSection, applyingSortTag) {
        applyingSortTag.classList.add("selected-tag");

        if (applyingSortTag.classList.contains("all-tag")) return;

        let currHidingType = (applyingSortTag.classList.contains("class-tag") ? "project" : "class");
        let currHidingRoomCards = [...pageSection.querySelectorAll(`.room-collection .room-card.room-type-${currHidingType}`)];

        currHidingRoomCards.forEach((roomCard) => {
            roomCard.classList.add("room-card-hidden");
        });
    }
}

applyRoomControlInteraction();

////////////////////////////////////////////////////////////////////////
//Room Card Scripts
////////////////////////////////////////////////////////////////////////

function generateRoomCard(roomName, roomType, roomKey, roomIndex, roomSec) {
    let roomCardNode = createRoomCardNode(roomName, roomType, roomKey, roomIndex, roomSec);

    addRoomCardNode(roomCardNode, roomSec);
    addRoomCardFunction(roomKey, roomType, roomSec, roomName);
}

function createRoomCardNode(roomName, roomType, roomKey, roomIndex, roomSec) {
    let availableRoomBannerCount = 22;
    let modRoomIndex = roomIndex % availableRoomBannerCount;

    /**
    <div class="room-card">
        <div class="room-card-main" style="background-image: url('/image/card-background/${modRoomIndex}.jpg');">
            <span class="room-card-text">${roomName}</span>
            <span class="room-card-text">${roomType}</span>
            <span class="room-card-text-background"></span>
        </div>
        <div class="room-card-control">
            <div class="room-card-control-option delete-room-option">
                <i class="fa-sharp fa-solid fa-trash"></i>
            </div>
            <div class="room-card-utility-control">
                <div class="room-card-control-option open-file-option">
                    <i class="fa-sharp fa-solid fa-folder-open"></i>
                </div>
                <div class="room-card-control-option copy-code-option">
                    <i class="fa-sharp fa-solid fa-clipboard"></i>
                </div>
            </div>
        </div>
    </div>
    */

    let roomCardNode = document.createElement('div');
    roomCardNode.classList.add('room-card', `room-id${roomKey}`, `room-type-${roomType}`);

    let roomCardMainNode = document.createElement('div');
    roomCardMainNode.classList.add('room-card-main');
    roomCardMainNode.style = `background-image: url('/image/card-background/${modRoomIndex}.jpg');`;

    let roomCardTextNameNode = document.createElement('span');
    roomCardTextNameNode.classList.add('room-card-text');
    roomCardTextNameNode.innerText = roomName;

    let roomCardTextTypeNode = document.createElement('span');
    roomCardTextTypeNode.classList.add('room-card-text');
    roomCardTextTypeNode.innerText = roomType;

    let roomCardTextBackgroundNode = document.createElement('span');
    roomCardTextBackgroundNode.classList.add('room-card-text-background');

    roomCardMainNode.append(roomCardTextNameNode, roomCardTextTypeNode, roomCardTextBackgroundNode);

    let roomCardControlNode = document.createElement('div');
    roomCardControlNode.classList.add('room-card-control');

    let roomCardControlOptionUtilNodes = document.createElement('div');
    roomCardControlOptionUtilNodes.classList.add('room-card-utility-control');

    let roomCardControlOptionUtilFileIconNode = document.createElement('i');
    roomCardControlOptionUtilFileIconNode.classList.add('fa-sharp', 'fa-solid', 'fa-folder-open');

    let roomCardControlOptionUtilFileNode = document.createElement('div');
    roomCardControlOptionUtilFileNode.classList.add('room-card-control-option', 'open-file-option');

    roomCardControlOptionUtilFileNode.append(roomCardControlOptionUtilFileIconNode);

    roomCardControlOptionUtilNodes.append(roomCardControlOptionUtilFileNode);

    if (roomSec === "created") {
        let roomCardControlOptionUtilCodeIconNode = document.createElement('i');
        roomCardControlOptionUtilCodeIconNode.classList.add('fa-sharp', 'fa-solid', 'fa-clipboard');

        let roomCardControlOptionUtilCodeNode = document.createElement('div');
        roomCardControlOptionUtilCodeNode.classList.add('room-card-control-option', 'copy-code-option');

        roomCardControlOptionUtilCodeNode.append(roomCardControlOptionUtilCodeIconNode);

        roomCardControlOptionUtilNodes.append(roomCardControlOptionUtilCodeNode);
    }

    if (roomSec === "created") {
        let roomCardControlOptionDeleteIconNode = document.createElement('i');
        roomCardControlOptionDeleteIconNode.classList.add('fa-sharp', 'fa-solid', 'fa-trash');

        let roomCardControlOptionDeleteNode = document.createElement('div');
        roomCardControlOptionDeleteNode.classList.add('room-card-control-option', 'delete-room-option');

        roomCardControlOptionDeleteNode.append(roomCardControlOptionDeleteIconNode);

        roomCardControlNode.append(roomCardControlOptionDeleteNode);
    } else if (roomSec === "joined") {
        let roomCardControlOptionLeaveIconNode = document.createElement('i');
        roomCardControlOptionLeaveIconNode.classList.add('fa-sharp', 'fa-solid', 'fa-right-from-bracket', 'fa-flip-horizontal');

        let roomCardControlOptionLeaveNode = document.createElement('div');
        roomCardControlOptionLeaveNode.classList.add('room-card-control-option', 'delete-room-option');

        roomCardControlOptionLeaveNode.append(roomCardControlOptionLeaveIconNode);

        roomCardControlNode.append(roomCardControlOptionLeaveNode);
    }

    roomCardControlNode.append(roomCardControlOptionUtilNodes);

    roomCardNode.append(roomCardMainNode, roomCardControlNode);

    return roomCardNode;
}

function addRoomCardNode(roomCardNode, roomSec) {
    if (roomSec === "created") {
        let createdRoomsCollection = document.querySelector("#created-room-collection .room-collection");
        createdRoomsCollection.append(roomCardNode);
    } else if (roomSec === "joined") {
        let joinedRoomsCollection = document.querySelector("#joined-room-collection .room-collection");
        joinedRoomsCollection.append(roomCardNode);
    }
}

function addRoomCardFunction(roomKey, roomType, roomSec, roomName) {
    let roomCard = findRoomCard(roomKey, roomSec);

    setRoomCardLink(roomCard, roomKey, roomType, roomSec);

    if (roomSec === "created") {
        setRoomCardCopyCodeFunction(roomCard, roomKey);
        setRoomCardDeleteRoomFunction(roomCard, roomKey, roomType, roomName);
    } else if (roomSec === "joined") {
        setRoomCardLeaveRoomFunction(roomCard, roomKey, roomType, roomName);
    }
}

function findRoomCard(roomKey, roomSec) {
    if (roomSec === "created") {
        return document.querySelector(`#created-room-collection .room-collection .room-id${roomKey}`);
    } else if (roomSec === "joined") {
        return document.querySelector(`#joined-room-collection .room-collection .room-id${roomKey}`);
    }
}

function setRoomCardLink(roomCard, roomKey, roomType, roomSec) {
    roomCard.firstElementChild.onclick = (e) => {
        window.location.href = `/lab?rmid=${roomKey}&rmtp=${roomType}&rmpv=${roomSec}`;
    }
}

function setRoomCardCopyCodeFunction(roomCard, roomKey) {
    let roomCardCopyCodeButton = roomCard.querySelector(".room-card-control .room-card-utility-control .room-card-control-option.copy-code-option");

    roomCardCopyCodeButton.onclick = (e) => {
        navigator.clipboard.writeText(roomKey);
    };
}

function setRoomCardLeaveRoomFunction(roomCard, roomKey, roomType, roomName) {
    let roomCardLeaveRoomButton = roomCard.querySelector(".room-card-control .room-card-control-option.delete-room-option");

    roomCardLeaveRoomButton.onclick = (e) => {
        const confirmation = confirm("Are you sure you want to leave from this room (" + roomName + ") ?");

        if (confirmation) {
            const roomWithNameAndType = `${roomName}#${roomType}#${roomKey}`;

            const filesSlashRoomSlashUID = firebase.database().ref(`files/${roomKey}/${currentUserUID}`);

            const userSlashJoined = firebase.database().ref(`users/${currentUserUID}/joinedRooms`);
            const participantsRefFromRooms = firebase.database().ref(`rooms/${roomKey}/participants/`);

            const storageRef = firebase.storage().ref(`${roomKey}/${currentUserUID}`);

            userSlashJoined.once("value")
                .then(async (snapshot) => {
                    const joinedRoomList = snapshot.val();
                    const targetRoomKey = Object.keys(joinedRoomList).find(key => joinedRoomList[key] === roomWithNameAndType);
                    firebase.database().ref(`users/${currentUserUID}/joinedRooms/${targetRoomKey}`)
                        .remove()
                        .then(() => {
                            roomCard.remove();
                            participantsRefFromRooms.once("value")
                                .then(async (snapshot) => {
                                    const participantList = snapshot.val();
                                    const targetParticipantKey = Object.keys(participantList).find(key => participantList[key] === `${currentUserUID}`);
                                    firebase.database().ref(`rooms/${roomKey}/participants/${targetParticipantKey}`)
                                        .remove()
                                        .then(() => {
                                            if (storageRef) {
                                                storageRef.delete()
                                                    .then(() => {
                                                        console.log(`Storage folder ${roomKey}/${targetParticipantKey}  deleted`);
                                                        filesSlashRoomSlashUID.remove()
                                                            .then(() => {
                                                                console.log("Deleted files from files folder")
                                                            }).catch((error) => {
                                                                console.error(`Error deleting files folder ${roomKey}/${targetParticipantKey}:`, error);
                                                            })
                                                    })
                                                    .catch((error) => {
                                                        console.log(`Error deleting file from storage folder ${roomKey}/${targetParticipantKey}`);
                                                    });
                                            } else {
                                                console.log(`Storage folder ${roomKey}/${targetParticipantKey} does not exist.`);
                                                return;
                                            }
                                        }).catch((error) => {
                                            console.log("Can not delete target participant ", error);
                                        })
                                }).catch((error) => {
                                    console.log("Can not delete targetRoom ", error);
                                })
                        }).catch((error) => {
                            console.log("Can not delete targetRoom ", error);
                        })
                }).catch((error) => {
                    console.log("Can not access targetRoom ", error);
                })
        } else {
            return;
        }
    };
}

function setRoomCardDeleteRoomFunction(roomCard, roomKey, roomType, roomName) {
    let roomCardDeleteRoomButton = roomCard.querySelector(".room-card-control .room-card-control-option.delete-room-option");

    roomCardDeleteRoomButton.onclick = async (e) => {
        const confirmation = confirm("Are you sure you want to delete this room (" + roomName + ") ?");

        if (confirmation) {
            const roomWithNameAndType = `${roomName}#${roomType}#${roomKey}`;

            const listOfParticipantsID = [];

            const fireRefFiles = firebase.database().ref(`files/${roomKey}`);
            const fireRefUsers = firebase.database().ref(`users/${currentUserUID}/createdRooms`);
            const participantsRef = firebase.database().ref(`rooms/${roomKey}/participants`);
            const roomsRef = firebase.database().ref(`rooms/${roomKey}`);

            const storageRef = firebase.storage().ref(roomKey);


            fireRefUsers.once("value")
                .then(async (snapshot) => {
                    const createdRoomList = snapshot.val();

                    console.log(roomWithNameAndType);
                    console.log(createdRoomList);

                    const targetRoomKey = Object.keys(createdRoomList).find(key => { return createdRoomList[key] === roomWithNameAndType });
                    console.log(targetRoomKey);

                    try {
                        await firebase.database().ref(`users/${currentUserUID}/createdRooms/${targetRoomKey}`).remove();

                        const snapshot = await participantsRef.once("value");
                        const participantsData = snapshot.val();

                        if (participantsData) {
                            Object.values(participantsData).forEach((participant) => {
                                const userId = participant;
                                listOfParticipantsID.push(userId);
                            });

                            console.log("Participant IDs:", listOfParticipantsID);
                            const timestamp = firebase.database.ServerValue.TIMESTAMP;

                            roomCard.remove();
                            sendNotificationsAndDeleteJoinings(listOfParticipantsID, roomKey, roomType, roomName, timestamp)
                                .then(() => {
                                    roomsRef.remove()
                                        .then(() => {
                                            console.log("Deleted files from rooms");
                                            if (storageRef) {
                                                storageRef.delete()
                                                    .then(() => {
                                                        console.log(`Storage folder ${roomKey} deleted`);
                                                        fireRefFiles.remove()
                                                            .then(() => {
                                                                console.log("Deleted files from files folder");
                                                            }).catch((error) => {
                                                                console.error(`Error deleting files folder ${roomKey}:`, error);
                                                            })
                                                    })
                                                    .catch((error) => {
                                                        return;
                                                    });
                                            } else {
                                                console.log(`Storage folder ${roomKey} does not exist.`);
                                                return;
                                            }
                                        }).catch((error) => {
                                            console.log("Could notdeleted files from rooms");
                                        })
                                })
                        } else {
                            console.log("No participants found in the room.");
                            roomCard.remove();
                            roomsRef.remove()
                                .then(() => {
                                    console.log("Deleted files from rooms");
                                    if (storageRef) {
                                        storageRef.delete()
                                            .then(() => {
                                                console.log(`Storage folder ${roomKey} deleted`);
                                                fireRefFiles.remove()
                                                    .then(() => {
                                                        console.log("Deleted files from files folder");
                                                    }).catch((error) => {
                                                        console.error(`Error deleting files folder ${roomKey}:`, error);
                                                    });
                                            })
                                            .catch((error) => {
                                                return;
                                            });
                                    } else {
                                        console.log(`Storage folder ${roomKey} does not exist.`);
                                        return;
                                    }
                                }).catch((error) => {
                                    console.log("Could notdeleted files from rooms");
                                });
                        }
                    } catch (error) {
                        console.error("Error deleting room data or retrieving participants:", error);
                    }
                }).catch((error) => {
                    console.error("Error deleting from fireRefUsers", error);
                });
        } else {
            return;
        }
    }
}

async function sendNotificationsAndDeleteJoinings(listOfParticipantsID, roomKey, roomType, roomName, timestamp) {
    const deletionMessage = `You are unenrolled from ${roomName} because the room was deleted by the creator`;
    const roomWithNameAndType = `${roomName}#${roomType}#${roomKey}`;

    listOfParticipantsID.forEach((participantId) => {
        const notificationRef = firebase.database().ref(`users/${participantId}/notifications/${roomKey}`);

        notificationRef.set({
            message: deletionMessage,
            timestamp: timestamp,
        })
            .then(() => {
                console.log(`Notification added for user ${participantId}`);
                const participantRef = firebase.database().ref(`users/${participantId}/joinedRooms`);
                participantRef.once("value")
                    .then((snapshot) => {
                        const joinedRoomList = snapshot.val();

                        const targetRoomKey = Object.keys(joinedRoomList).find(key => joinedRoomList[key] === roomWithNameAndType);

                        firebase.database().ref(`users/${participantId}/joinedRooms/${targetRoomKey}`).remove()
                            .then(() => {
                                console.log(`Room ${roomKey} removed from user ${participantId}`);
                            }).catch((error) => {
                                console.error(`Error removing room ${roomKey} from user ${participantId}:`, error);
                            })
                    })
                    .catch((error) => {
                        console.error(`Error removing room ${roomKey} from user ${participantId}:`, error);
                    });
            })
            .catch((error) => {
                console.error(`Error adding notification for user ${participantId}:`, error);
            });
    });
}
