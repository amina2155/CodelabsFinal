const database = firebase.database();

// Function to generate a unique username from the email
function generateUniqueUsername(email, existingUsernames) {
  const username = email.split("@")[0]; // Use the part before '@' as the initial username

  // Check if the initial username is unique, if not, append numbers to make it unique
  let newUsername = username;
  let counter = 1;
  while (existingUsernames.includes(newUsername)) {
    newUsername = `${username}${counter}`;
    counter++;
  }

  return newUsername;
}

document.getElementById("login-button").addEventListener("click", async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);

    const userRef = firebase.database().ref("users/" + result.user.uid);

    if (result.additionalUserInfo.isNewUser) {
      const fullName = result.user.displayName;
      const email = result.user.email;

      const existingUsernames = [];
      const usersSnapshot = await firebase
        .database()
        .ref("users")
        .once("value");
      usersSnapshot.forEach((userSnapshot) => {
        const userData = userSnapshot.val();
        if (userData.username) {
          existingUsernames.push(userData.username);
          console.log(userData.username);
        }
      });

      const newUsername = generateUniqueUsername(email, existingUsernames);

      await userRef.set({
        username: newUsername,
        displayName: fullName,
        email: email,
        profilePicture: result.user.photoURL,
        loginTime: new Date().toString(),
        logoutTime: null,
        login_status: "true",
        logout_status: "false",
        numberOfCreatedRooms: 0,
        numberOfJoinedRooms: 0,
      });
    } else {
      // Update login information
      await userRef.update({
        loginTime: new Date().toString(),
        logoutTime: null,
        login_status: "true",
        logout_status: "false",
      });
    }

    console.log("Redirecting to profile page...");

    window.location.href = "/profile";
  } catch (error) {
    console.error(error);
  }
});
