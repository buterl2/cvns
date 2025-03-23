const firebaseConfig = {
    apiKey: "AIzaSyBOK2XbeOYj84Js5C1UavwlAKdvwCTgIqk",
    authDomain: "planningboard-ecd11.firebaseapp.com",
    databaseURL: "https://planningboard-ecd11-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "planningboard-ecd11",
    storageBucket: "planningboard-ecd11.firebasestorage.app",
    messagingSenderId: "84948240741",
    appId: "1:84948240741:web:9d857f0fc0b783922cf98c"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  
  // Export the database for use in other files
  window.db = database;