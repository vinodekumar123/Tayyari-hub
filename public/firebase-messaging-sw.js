importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyD30ttpHoP4xaQEjuPgCbyguZ8yMDOw0RM",
    authDomain: "tayyarihub.firebaseapp.com",
    projectId: "tayyari-hub",
    storageBucket: "tayyari-hub.appspot.com",
    messagingSenderId: "476210572589",
    appId: "1:476210572589:web:14444ade6d84edba8df7a4",
    measurementId: "G-H21039HJ2F",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/firebase-logo.png' // You can change this to your app icon
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
