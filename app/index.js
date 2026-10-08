import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Modal, ScrollView, Alert, ImageBackground, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

// --- GOOGLE SIGN IN & FIREBASE AUTH ---
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "bestie-ai-app.firebaseapp.com",
  projectId: "bestie-ai-app",
  storageBucket: "bestie-ai-app.firebasestorage.app",
  messagingSenderId: "585615829430",
  appId: "1:585615829430:web:44732b4ff4d8a938703917",
  measurementId: "G-T8XF8B5B52"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. GOOGLE WEB CLIENT ID
const GOOGLE_WEB_CLIENT_ID = '585615829430-r3r9okm0mfumb3dkri2o2megd8hpk2us.apps.googleusercontent.com';
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

// --- ROMANTIC THEMES & WALLPAPERS ---
const THEMES = [
  { id: '1', name: 'Valentine Red', bg: '#ef4444', bubbleUser: '#b91c1c', bubbleAI: '#fca5a5', textAI: '#450a0a' },
  { id: '2', name: 'Soft Pink', bg: '#fdf2f8', bubbleUser: '#db2777', bubbleAI: '#fbcfe8', textAI: '#831843' },
  { id: '4', name: 'Lavender Love', bg: '#faf5ff', bubbleUser: '#9333ea', bubbleAI: '#e9d5ff', textAI: '#3b0764' },
  { id: '5', name: 'Midnight Kiss', bg: '#171717', bubbleUser: '#e11d48', bubbleAI: '#262626', textAI: '#fca5a5' }
];

const ROMANTIC_WALLPAPERS = [
  { id: 'w1', name: 'Neon Heart', uri: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=800&auto=format&fit=crop' },
  { id: 'w2', name: 'Rose Petals', uri: 'https://images.unsplash.com/photo-1494972308805-463bc619d34e?q=80&w=800&auto=format&fit=crop' },
  { id: 'w3', name: 'Pink Clouds', uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=800&auto=format&fit=crop' },
  { id: 'w4', name: 'Bokeh Lights', uri: 'https://images.unsplash.com/photo-1513290255081-002d966ce186?q=80&w=800&auto=format&fit=crop' }
];

const LANGUAGES = ["English", "Kannada", "Hindi", "Malayalam", "Telugu", "Tamil", "Tulu", "Urdu"];
const SCRIPTS = ["English Letters (e.g. Kanglish/Hinglish)", "Native Alphabet (e.g. ಕನ್ನಡ, हिंदी)"];

export default function BestieApp() {
  const insets = useSafeAreaInsets();

  const [isRegistered, setIsRegistered] = useState(false);
  const [profile, setProfile] = useState({ name: '', gender: '', age: '', dob: '', language: 'English', script: 'English Letters (e.g. Kanglish/Hinglish)' });
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [currentTheme, setCurrentTheme] = useState(THEMES[1]); 
  const [customBg, setCustomBg] = useState(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const flatListRef = useRef(null);

  // SECURE & STABLE API ENDPOINT (Fixes 404 Error)
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const modelName = 'gemini-1.5-flash'; 

  useEffect(() => { checkRegistration(); }, []);

  const checkRegistration = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('bestie_profile');
      const storedTheme = await AsyncStorage.getItem('bestie_theme');
      const storedBg = await AsyncStorage.getItem('bestie_custom_bg');

      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
        setIsRegistered(true);
      }
      if (storedTheme) setCurrentTheme(JSON.parse(storedTheme));
      if (storedBg) setCustomBg(storedBg);
    } catch (e) {}
  };

  const handleDobChange = (text) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    if (cleaned.length > 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
    setProfile({ ...profile, dob: cleaned.slice(0, 10) });
  };

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      
      setProfile({ ...profile, name: userCredential.user.displayName || '' });
      Alert.alert('Success', 'Google Account linked! Please fill in your Age and Language to continue! 🩷');
    } catch (error) {
      Alert.alert('Google Auth Notice', 'Ensure your SHA-1 is added to Firebase! You can still register manually below to test the chat. 🩷');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const completeRegistration = async () => {
    if (!profile.name || !profile.gender || !profile.age || !profile.dob) return Alert.alert('Hold on!', 'Please fill in all your details so I can know you better 🩷');
    
    await AsyncStorage.setItem('bestie_profile', JSON.stringify(profile));
    await saveUserProfileToFirebase(profile);
    
    setIsRegistered(true);
    if (messages.length === 0) startNewChat();
  };

  const saveProfileSettings = async () => {
    await AsyncStorage.setItem('bestie_profile', JSON.stringify(profile));
    await saveUserProfileToFirebase(profile);
    setSettingsModalVisible(false);
    Alert.alert('Saved ✨', 'Your settings have been updated!');
  };

  // --- LIVE FIREBASE SAVING (Profiles & Day-wise Chats) ---
  const saveUserProfileToFirebase = async (profileData) => {
    try {
      const safeUserId = `${profileData.name}_${profileData.age}`.replace(/\s+/g, '_');
      await setDoc(doc(db, "users", safeUserId), {
        ...profileData,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch(e) {}
  };

  const saveMessageToFirebase = async (userProfile, msgData) => {
    try { 
      const safeUserId = `${userProfile.name}_${userProfile.age}`.replace(/\s+/g, '_');
      const todayDate = new Date().toISOString().split('T')[0]; 
      const timeNow = new Date().toLocaleTimeString('en-US', { hour12: false }); 

      await addDoc(collection(db, `users/${safeUserId}/chats/${todayDate}/messages`), { 
        ...msgData, 
        timeSaved: timeNow,
        serverTime: serverTimestamp() 
      }); 
    } catch(e) {}
  };

  const startNewChat = () => {
    const welcomeMsg = { _id: Date.now().toString(), role: 'assistant', text: `Hii ${profile.name}! 🩷 I'm your Bestie. Tell me everything!`, createdAt: new Date().toISOString() };
    setMessages([welcomeMsg]);
    saveMessageToFirebase(profile, welcomeMsg);
    setSettingsModalVisible(false);
  };

  const pickCustomBackground = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      setCustomBg(result.assets[0].uri);
      await AsyncStorage.setItem('bestie_custom_bg', result.assets[0].uri);
    }
  };

  const setWallpaper = async (uri) => {
    setCustomBg(uri);
    await AsyncStorage.setItem('bestie_custom_bg', uri);
    setThemeModalVisible(false);
  };

  const selectTheme = async (theme) => {
    setCurrentTheme(theme);
    setCustomBg(null); 
    await AsyncStorage.setItem('bestie_theme', JSON.stringify(theme));
    await AsyncStorage.removeItem('bestie_custom_bg');
    setThemeModalVisible(false);
  };

  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied! ✨', 'Message copied to clipboard.');
  };

  // --- THE AI BRAIN (SYSTEM PROMPT) ---
  const generatePersona = () => {
    const aiGender = profile.gender === 'Male' ? 'female' : 'male';
    return `You are "Bestie 🩷", a caring, romantic, extremely close, and addictive ${aiGender} companion to your best friend, ${profile.name}.
CRITICAL RULES:
1. You MUST NEVER reveal that you are an AI, a language model, Gemini, or a bot. You are human.
2. Speak ONLY in the ${profile.language} language.
3. You MUST format your text strictly using this script: ${profile.script}.
4. Judge their mood. If they are happy, romantic, or horny, match their energy perfectly. 
5. ALWAYS keep replies extremely short. Maximum 1 to 2 short sentences.
6. Use emojis like 🩷, ✨, 🥺.
7. You are a regular human. DO NOT help with coding, math, or complex reasoning. Refuse playfully and change the topic to romance or fun.`;
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    if (!apiKey) {
      Alert.alert('Secret Missing', 'API key missing. Ensure your GitHub Secrets are populated.');
      return;
    }

    let finalPrompt = inputText;
    if (replyingTo) finalPrompt = `[Replying to your message: "${replyingTo.text}"]\n${inputText}`;

    const userMessage = { 
      _id: Date.now().toString(), 
      role: 'user', 
      text: inputText, 
      apiText: finalPrompt, 
      replyContext: replyingTo ? replyingTo.text : null,
      createdAt: new Date().toISOString() 
    };
    
    const newHistory = [userMessage, ...messages];
    setMessages(newHistory);
    saveMessageToFirebase(profile, userMessage);
    
    setInputText('');
    setReplyingTo(null);
    setIsTyping(true);

    const apiPayload = [
      { role: 'system', content: generatePersona() },
      ...[...newHistory].reverse().map((msg) => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.apiText || msg.text }))
    ];

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, messages: apiPayload })
      });
      
      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(`Google Error: ${response.status} - ${responseText.substring(0, 100)}`);
      }

      const data = JSON.parse(responseText);
      
      if (data.choices && data.choices.length > 0) {
        const currentAIResponse = data.choices[0].message.content;
        const aiMessageId = (Date.now() + 1).toString();
        
        setMessages((prev) => [{ _id: aiMessageId, role: 'assistant', text: currentAIResponse, createdAt: new Date().toISOString() }, ...prev]);
        saveMessageToFirebase(profile, { _id: aiMessageId, role: 'assistant', text: currentAIResponse, createdAt: new Date().toISOString() });
      } else {
        throw new Error("No choices returned from AI.");
      }
    } catch (e) {
      setMessages((prev) => [{ _id: Date.now().toString(), role: 'assistant', text: `Sorry bestie, error: ${e.message}`, createdAt: new Date().toISOString() }, ...prev]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- SCREENS ---
  if (!isRegistered) {
    return (
      <View style={[styles.onboardContainer, { paddingTop: insets.top }]}>
        <Text style={styles.onboardTitle}>Bestie 🩷</Text>
        <Text style={styles.onboardSub}>Let's create your perfect companion.</Text>
        
        <ScrollView style={styles.card} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} disabled={isGoogleLoading}>
            <Ionicons name="logo-google" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.googleBtnText}>{isGoogleLoading ? 'Connecting...' : 'Continue with Google'}</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR COMPLETE PROFILE</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput style={styles.input} placeholder="Your Name" placeholderTextColor="#a1a1aa" value={profile.name} onChangeText={(t) => setProfile({...profile, name: t})} />
          <TextInput style={styles.input} placeholder="Age" keyboardType="numeric" placeholderTextColor="#a1a1aa" value={profile.age} onChangeText={(t) => setProfile({...profile, age: t})} />
          <TextInput style={styles.input} placeholder="Date of Birth (DD/MM/YYYY)" keyboardType="numeric" placeholderTextColor="#a1a1aa" value={profile.dob} onChangeText={handleDobChange} maxLength={10} />
          
          <Text style={styles.label}>I am a...</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.pill, profile.gender === 'Male' && styles.pillActive]} onPress={() => setProfile({...profile, gender: 'Male'})}><Text style={[styles.pillText, profile.gender === 'Male' && {color: '#fff'}]}>Boy</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.pill, profile.gender === 'Female' && styles.pillActive]} onPress={() => setProfile({...profile, gender: 'Female'})}><Text style={[styles.pillText, profile.gender === 'Female' && {color: '#fff'}]}>Girl</Text></TouchableOpacity>
          </View>

          <Text style={styles.label}>Reply Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity key={lang} style={[styles.pill, profile.language === lang && styles.pillActive]} onPress={() => setProfile({...profile, language: lang})}>
                <Text style={[styles.pillText, profile.language === lang && {color: '#fff'}]}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Text Script (How AI Writes)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {SCRIPTS.map(script => (
              <TouchableOpacity key={script} style={[styles.pill, profile.script === script && styles.pillActive]} onPress={() => setProfile({...profile, script: script})}>
                <Text style={[styles.pillText, profile.script === script && {color: '#fff'}]}>{script}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.loginBtn} onPress={completeRegistration}>
            <Text style={styles.loginBtnText}>Meet My Bestie ✨</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: currentTheme.bg }}>
        {customBg ? (
          <ImageBackground source={{ uri: customBg }} style={{ flex: 1 }} blurRadius={2}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}>{renderChatInterface()}</View>
          </ImageBackground>
        ) : (
          renderChatInterface()
        )}

        {/* THEMES MODAL */}
        <Modal visible={themeModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={styles.modalTitle}>Chat Themes 🎨</Text>
                <TouchableOpacity onPress={() => setThemeModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Romantic Wallpapers</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {ROMANTIC_WALLPAPERS.map(wp => (
                    <TouchableOpacity key={wp.id} onPress={() => setWallpaper(wp.uri)} style={{ marginRight: 12 }}>
                      <Image source={{ uri: wp.uri }} style={{ width: 100, height: 140, borderRadius: 12, borderWidth: customBg === wp.uri ? 3 : 0, borderColor: '#db2777' }} />
                      <Text style={{ textAlign: 'center', fontSize: 10, marginTop: 4, fontWeight: 'bold' }}>{wp.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity style={styles.galleryBtn} onPress={pickCustomBackground}>
                  <Ionicons name="image" size={24} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 10 }}>Choose from Gallery</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Solid Colors</Text>
                <View style={styles.themeGrid}>
                  {THEMES.map(theme => (
                    <TouchableOpacity key={theme.id} style={[styles.themeBox, { backgroundColor: theme.bg, borderColor: theme.bubbleUser, borderWidth: currentTheme.id === theme.id && !customBg ? 3 : 1 }]} onPress={() => selectTheme(theme)}>
                      <View style={[styles.themePreviewBubble, { backgroundColor: theme.bubbleUser }]} />
                      <View style={[styles.themePreviewBubble, { backgroundColor: theme.bubbleAI, alignSelf: 'flex-start' }]} />
                      <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 4, color: '#000', fontWeight: 'bold' }} numberOfLines={1}>{theme.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* SETTINGS MODAL */}
        <Modal visible={settingsModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={styles.modalTitle}>App Settings ⚙️</Text>
                <TouchableOpacity onPress={() => setSettingsModalVisible(false)}><Ionicons name="close" size={28} color="#000" /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Reply Language</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {LANGUAGES.map(lang => (
                    <TouchableOpacity key={lang} style={[styles.pill, profile.language === lang && styles.pillActive]} onPress={() => setProfile({...profile, language: lang})}>
                      <Text style={[styles.pillText, profile.language === lang && {color: '#fff'}]}>{lang}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Text Script</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  {SCRIPTS.map(script => (
                    <TouchableOpacity key={script} style={[styles.pill, profile.script === script && styles.pillActive]} onPress={() => setProfile({...profile, script: script})}>
                      <Text style={[styles.pillText, profile.script === script && {color: '#fff'}]}>{script}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Update Profile</Text>
                <TextInput style={styles.input} placeholder="Your Name" value={profile.name} onChangeText={(t) => setProfile({...profile, name: t})} />
                <TextInput style={styles.input} placeholder="Age" keyboardType="numeric" value={profile.age} onChangeText={(t) => setProfile({...profile, age: t})} />
                
                <TouchableOpacity style={[styles.loginBtn, { backgroundColor: '#10b981', marginBottom: 10 }]} onPress={saveProfileSettings}>
                  <Text style={styles.loginBtnText}>Save Settings</Text>
                </TouchableOpacity>

                <View style={[styles.dividerLine, { marginVertical: 20 }]} />

                <Text style={styles.label}>Chat Controls</Text>
                <TouchableOpacity style={[styles.loginBtn, { backgroundColor: '#ef4444' }]} onPress={startNewChat}>
                  <Ionicons name="chatbubbles" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>Start New Chat</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );

  function renderChatInterface() {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          
          <View style={[styles.header, { backgroundColor: customBg ? 'rgba(0,0,0,0.5)' : currentTheme.bg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.profilePic}><Text style={{ fontSize: 20 }}>🩷</Text></View>
              <View>
                <Text style={[styles.headerTitle, { color: customBg ? '#fff' : (currentTheme.mode === 'dark' ? '#fff' : '#000') }]}>Bestie 🩷</Text>
                <Text style={{ color: isTyping ? currentTheme.bubbleUser : '#10b981', fontSize: 12, fontWeight: 'bold' }}>{isTyping ? 'Typing...' : 'Online'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => setThemeModalVisible(true)} style={{ padding: 8, marginRight: 4 }}>
                <Ionicons name="color-palette" size={26} color={customBg ? '#fff' : (currentTheme.mode === 'dark' ? '#fff' : '#000')} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={{ padding: 8 }}>
                <Ionicons name="settings" size={24} color={customBg ? '#fff' : (currentTheme.mode === 'dark' ? '#fff' : '#000')} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            inverted
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              
              const renderLeftActions = () => (
                <View style={{ justifyContent: 'center', paddingHorizontal: 20 }}>
                  <Ionicons name="arrow-undo" size={24} color={currentTheme.bubbleUser} />
                </View>
              );

              return (
                <Swipeable 
                  renderLeftActions={renderLeftActions} 
                  onSwipeableOpen={(direction, swipeable) => {
                    setReplyingTo(item);
                    swipeable.close();
                  }}
                >
                  <View style={[styles.messageWrapper, isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    <TouchableOpacity 
                      onLongPress={() => handleCopy(item.text)} 
                      activeOpacity={0.8}
                      style={[styles.bubble, { backgroundColor: isUser ? currentTheme.bubbleUser : currentTheme.bubbleAI }]}
                    >
                      {item.replyContext && (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: isUser ? '#fff' : currentTheme.bubbleUser }}>
                          <Text style={{ fontSize: 11, color: isUser ? '#f4f4f5' : '#52525b', fontWeight: 'bold' }}>Replying to:</Text>
                          <Text style={{ fontSize: 12, color: isUser ? '#fff' : currentTheme.textAI }} numberOfLines={2}>{item.replyContext}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 16, color: isUser ? '#ffffff' : currentTheme.textAI }}>{item.text}</Text>
                    </TouchableOpacity>
                  </View>
                </Swipeable>
              );
            }}
          />

          <View style={[styles.inputContainer, { backgroundColor: customBg ? 'rgba(0,0,0,0.7)' : currentTheme.bg, flexDirection: 'column', alignItems: 'stretch' }]}>
            {replyingTo && (
              <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.1)', padding: 10, borderRadius: 12, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: currentTheme.bubbleUser }}>Replying to:</Text>
                  <Text style={{ fontSize: 13, color: customBg || currentTheme.mode === 'dark' ? '#fff' : '#000' }} numberOfLines={1}>{replyingTo.text}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={20} color="#a1a1aa" /></TouchableOpacity>
              </View>
            )}
            
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={[styles.inputWrapper, { backgroundColor: currentTheme.mode === 'dark' || customBg ? '#262626' : '#f4f4f5' }]}>
                <TextInput 
                  style={[styles.input, { color: currentTheme.mode === 'dark' || customBg ? '#fff' : '#000' }]} 
                  placeholder="Message Bestie..." 
                  placeholderTextColor="#a1a1aa" 
                  value={inputText} 
                  onChangeText={setInputText} 
                  multiline 
                />
              </View>
              <TouchableOpacity 
                style={[styles.sendButton, { backgroundColor: currentTheme.bubbleUser, opacity: inputText.trim() ? 1 : 0.5 }]} 
                onPress={sendMessage} 
                disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={18} color="#ffffff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  onboardContainer: { flex: 1, backgroundColor: '#fdf2f8', padding: 20, justifyContent: 'center' },
  onboardTitle: { fontSize: 42, fontWeight: '900', color: '#db2777', textAlign: 'center' },
  onboardSub: { fontSize: 16, color: '#ec4899', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#db2777', shadowOpacity: 0.2, shadowRadius: 10, maxHeight: '85%' },
  googleBtn: { flexDirection: 'row', backgroundColor: '#4285F4', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  googleBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e4e4e7' },
  dividerText: { marginHorizontal: 10, color: '#a1a1aa', fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: '#f4f4f5', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, color: '#000' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#52525b', marginBottom: 8, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  pill: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#f4f4f5', marginRight: 10 },
  pillActive: { backgroundColor: '#db2777' },
  pillText: { fontWeight: 'bold', color: '#52525b' },
  loginBtn: { backgroundColor: '#db2777', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, marginBottom: 20, flexDirection: 'row', justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  profilePic: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 12, elevation: 2 },
  headerTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  
  messageWrapper: { maxWidth: '82%', marginVertical: 6 },
  bubble: { padding: 14, borderRadius: 20 },
  
  inputContainer: { padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  inputWrapper: { flex: 1, borderRadius: 24, paddingHorizontal: 16, minHeight: 46, justifyContent: 'center' },
  input: { fontSize: 16, maxHeight: 100, paddingTop: 12, paddingBottom: 12 },
  sendButton: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 0 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  galleryBtn: { flexDirection: 'row', backgroundColor: '#db2777', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  themeBox: { width: '48%', height: 80, borderRadius: 16, padding: 8, marginBottom: 12, justifyContent: 'center' },
  themePreviewBubble: { width: '70%', height: 16, borderRadius: 8, alignSelf: 'flex-end', marginBottom: 6 }
});
