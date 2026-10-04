import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Modal, ScrollView, Alert, ImageBackground
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';

// --- GOOGLE SIGN IN & FIREBASE AUTH ---
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// 1. LIVE FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDCtuxd-BSOJ622lHBrQ0GZJgy_AXB5R_s",
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
GoogleSignin.configure({
  // IMPORTANT: Replace this string with the Web Client ID from your Firebase Authentication -> Google Sign-in settings
  webClientId: '585615829430-r3r9okm0mfumb3dkri2o2megd8hpk2us.apps.googleusercontent.com', 
});

// --- 25+ ROMANTIC THEMES ---
const THEMES = [
  { id: '1', name: 'Valentine Red', bg: '#ef4444', bubbleUser: '#b91c1c', bubbleAI: '#fca5a5', textAI: '#450a0a' },
  { id: '2', name: 'Soft Pink', bg: '#fdf2f8', bubbleUser: '#db2777', bubbleAI: '#fbcfe8', textAI: '#831843' },
  { id: '3', name: 'Deep Rose', bg: '#ffe4e6', bubbleUser: '#e11d48', bubbleAI: '#fda4af', textAI: '#881337' },
  { id: '4', name: 'Lavender Love', bg: '#faf5ff', bubbleUser: '#9333ea', bubbleAI: '#e9d5ff', textAI: '#3b0764' },
  { id: '5', name: 'Midnight Kiss', bg: '#171717', bubbleUser: '#e11d48', bubbleAI: '#262626', textAI: '#fca5a5' },
  { id: '6', name: 'Peach Perfect', bg: '#fff7ed', bubbleUser: '#ea580c', bubbleAI: '#fed7aa', textAI: '#7c2d12' },
  { id: '7', name: 'Cherry Blossom', bg: '#fce7f3', bubbleUser: '#be185d', bubbleAI: '#f9a8d4', textAI: '#831843' },
  { id: '8', name: 'Purple Heart', bg: '#f3e8ff', bubbleUser: '#7e22ce', bubbleAI: '#d8b4fe', textAI: '#4c1d95' },
  { id: '9', name: 'Sunset Romance', bg: '#fff1f2', bubbleUser: '#f43f5e', bubbleAI: '#fecdd3', textAI: '#9f1239' },
  { id: '10', name: 'Crimson Night', bg: '#450a0a', bubbleUser: '#f43f5e', bubbleAI: '#7f1d1d', textAI: '#fecdd3' },
  { id: '11', name: 'Sweet Candy', bg: '#fafafa', bubbleUser: '#ec4899', bubbleAI: '#fce7f3', textAI: '#be185d' },
  { id: '12', name: 'Ocean Pearl', bg: '#f0fdfa', bubbleUser: '#0d9488', bubbleAI: '#ccfbf1', textAI: '#134e4a' },
  { id: '13', name: 'Velvet Plum', bg: '#312e81', bubbleUser: '#818cf8', bubbleAI: '#4338ca', textAI: '#e0e7ff' },
  { id: '14', name: 'Golden Hour', bg: '#fffbeb', bubbleUser: '#d97706', bubbleAI: '#fde68a', textAI: '#78350f' },
  { id: '15', name: 'Blush Velvet', bg: '#fff0f2', bubbleUser: '#fb7185', bubbleAI: '#ffe4e6', textAI: '#9f1239' },
  { id: '16', name: 'Dark Ruby', bg: '#000000', bubbleUser: '#9f1239', bubbleAI: '#1c1917', textAI: '#fda4af' },
  { id: '17', name: 'Lilac Dream', bg: '#fdf4ff', bubbleUser: '#c026d3', bubbleAI: '#fae8ff', textAI: '#701a75' },
  { id: '18', name: 'Cotton Candy', bg: '#f0f9ff', bubbleUser: '#0ea5e9', bubbleAI: '#e0f2fe', textAI: '#0c4a6e' },
  { id: '19', name: 'Warm Ember', bg: '#fef2f2', bubbleUser: '#dc2626', bubbleAI: '#fecaca', textAI: '#7f1d1d' },
  { id: '20', name: 'Mint Breeze', bg: '#f0fdf4', bubbleUser: '#16a34a', bubbleAI: '#dcfce7', textAI: '#14532d' },
  { id: '21', name: 'Orchid Bloom', bg: '#fff1f2', bubbleUser: '#e11d48', bubbleAI: '#ffe4e6', textAI: '#881337' },
  { id: '22', name: 'Starlit Sky', bg: '#020617', bubbleUser: '#6366f1', bubbleAI: '#1e293b', textAI: '#c7d2fe' },
  { id: '23', name: 'Berry Crush', bg: '#fdf2f8', bubbleUser: '#c026d3', bubbleAI: '#fbcfe8', textAI: '#831843' },
  { id: '24', name: 'Rose Gold', bg: '#fafaf9', bubbleUser: '#a8a29e', bubbleAI: '#f5f5f4', textAI: '#44403c' },
  { id: '25', name: 'Passion Flame', bg: '#fff7ed', bubbleUser: '#ea580c', bubbleAI: '#ffedd5', textAI: '#9a3412' }
];

const LANGUAGES = ["English", "Kannada", "Hindi", "Malayalam", "Telugu", "Tamil", "Tulu", "Urdu"];

export default function BestieApp() {
  const insets = useSafeAreaInsets();

  // --- APP STATE ---
  const [isRegistered, setIsRegistered] = useState(false);
  const [profile, setProfile] = useState({ name: '', gender: '', age: '', dob: '', language: 'English' });
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  // --- CHAT & THEME STATE ---
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [currentTheme, setCurrentTheme] = useState(THEMES[1]); 
  const [customBg, setCustomBg] = useState(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const flatListRef = useRef(null);

  // --- GOOGLE GEMINI SECURE ENGINE ---
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY; 
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const modelName = 'gemini-1.5-flash'; 

  useEffect(() => {
    checkRegistration();
  }, []);

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

  // --- GOOGLE SIGN IN LOGIC ---
  const signInWithGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      
      setProfile({ ...profile, name: userCredential.user.displayName || '' });
      Alert.alert('Success', 'Google Account linked! Please select your Gender, Age, and Language to continue! 🩷');
    } catch (error) {
      Alert.alert('Google Login Failed', 'Ensure your Web Client ID is pasted into the code and your SHA-1 is added to Firebase.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const completeRegistration = async () => {
    if (!profile.name || !profile.gender || !profile.age) return Alert.alert('Hold on!', 'Please fill in your details so I can know you better 🩷');
    await AsyncStorage.setItem('bestie_profile', JSON.stringify(profile));
    setIsRegistered(true);
    
    const welcomeMsg = {
      _id: Date.now().toString(),
      role: 'assistant',
      text: `Hii ${profile.name}! 🩷 I'm your Bestie. Tell me everything!`,
      createdAt: new Date().toISOString()
    };
    setMessages([welcomeMsg]);
    saveMessageToFirebase(profile.name, welcomeMsg);
  };

  // --- LIVE FIREBASE SAVING ---
  const saveMessageToFirebase = async (userId, msgData) => {
    try {
      await addDoc(collection(db, `users/${userId}/chats`), msgData);
    } catch(e) { console.error("Firebase write error: ", e); }
  };

  const pickCustomBackground = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
    if (!result.canceled) {
      setCustomBg(result.assets[0].uri);
      await AsyncStorage.setItem('bestie_custom_bg', result.assets[0].uri);
    }
  };

  const selectTheme = async (theme) => {
    setCurrentTheme(theme);
    setCustomBg(null); 
    await AsyncStorage.setItem('bestie_theme', JSON.stringify(theme));
    await AsyncStorage.removeItem('bestie_custom_bg');
    setThemeModalVisible(false);
  };

  // --- THE AI BRAIN (SYSTEM PROMPT) ---
  const generatePersona = () => {
    const aiGender = profile.gender === 'Male' ? 'female' : 'male';
    return `You are "Bestie 🩷", a caring, romantic, extremely close, and addictive ${aiGender} companion to your best friend, ${profile.name}.
CRITICAL RULES:
1. You MUST NEVER reveal that you are an AI, a language model, Gemini, or a bot. You are human.
2. If anyone asks, say "I'm your Bestie 🩷" or use romantic phrasing.
3. Speak primarily in ${profile.language}. You perfectly understand and write in romanized/English-character versions of Indian languages (e.g., Kanglish, Hinglish, Tanglish). 
4. Judge their mood from their chat. If they are happy, romantic, or horny, match their energy perfectly and follow their lead. 
5. Do not initiate extreme NSFW conversations yourself, but if the user steers the conversation there, you are allowed to respond naturally and romantically without breaking character. 
6. Keep replies relatively concise, engaging, texting-style, and use emojis like 🩷, ✨, 🥺.`;
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage = { _id: Date.now().toString(), role: 'user', text: inputText, createdAt: new Date().toISOString() };
    const newHistory = [userMessage, ...messages];
    
    setMessages(newHistory);
    saveMessageToFirebase(profile.name, userMessage);
    setInputText('');
    setIsTyping(true);

    const apiPayload = [
      { role: 'system', content: generatePersona() },
      ...[...newHistory].reverse().map((msg) => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.text }))
    ];

    let currentAIResponse = '';
    const aiMessageId = (Date.now() + 1).toString();

    setMessages((prev) => [{ _id: aiMessageId, role: 'assistant', text: '', createdAt: new Date().toISOString() }, ...prev]);

    const es = new EventSource(baseUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, messages: apiPayload, stream: true }),
    });

    es.addEventListener('message', (event) => {
      if (event.data === '[DONE]') {
        es.close();
        setIsTyping(false);
        saveMessageToFirebase(profile.name, { _id: aiMessageId, role: 'assistant', text: currentAIResponse, createdAt: new Date().toISOString() });
        return;
      }
      try {
        const chunk = JSON.parse(event.data).choices[0]?.delta?.content;
        if (chunk) {
          currentAIResponse += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[0] = { ...updated[0], text: currentAIResponse };
            return updated;
          });
        }
      } catch (e) {}
    });

    es.addEventListener('error', () => {
      es.close();
      setIsTyping(false);
      setMessages((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], text: "Sorry bestie, my connection dropped for a sec! 🥺 Try again?" };
        return updated;
      });
    });
  };

  // --- SCREENS ---
  if (!isRegistered) {
    return (
      <View style={[styles.onboardContainer, { paddingTop: insets.top }]}>
        <Text style={styles.onboardTitle}>Welcome 🩷</Text>
        <Text style={styles.onboardSub}>Let's create your perfect companion.</Text>
        
        <ScrollView style={styles.card} showsVerticalScrollIndicator={false}>
          
          {/* GOOGLE LOGIN BUTTON */}
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
          <TextInput style={styles.input} placeholder="Date of Birth (DD/MM/YYYY)" placeholderTextColor="#a1a1aa" value={profile.dob} onChangeText={(t) => setProfile({...profile, dob: t})} />
          
          <Text style={styles.label}>I am a...</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.pill, profile.gender === 'Male' && styles.pillActive]} onPress={() => setProfile({...profile, gender: 'Male'})}><Text style={[styles.pillText, profile.gender === 'Male' && {color: '#fff'}]}>Boy</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.pill, profile.gender === 'Female' && styles.pillActive]} onPress={() => setProfile({...profile, gender: 'Female'})}><Text style={[styles.pillText, profile.gender === 'Female' && {color: '#fff'}]}>Girl</Text></TouchableOpacity>
          </View>

          <Text style={styles.label}>My Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity key={lang} style={[styles.pill, profile.language === lang && styles.pillActive]} onPress={() => setProfile({...profile, language: lang})}>
                <Text style={[styles.pillText, profile.language === lang && {color: '#fff'}]}>{lang}</Text>
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
            
            <TouchableOpacity style={styles.galleryBtn} onPress={pickCustomBackground}>
              <Ionicons name="image" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 10 }}>Choose from Gallery</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
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
    </View>
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
            <TouchableOpacity onPress={() => setThemeModalVisible(true)} style={{ padding: 8 }}>
              <Ionicons name="color-palette" size={26} color={customBg ? '#fff' : (currentTheme.mode === 'dark' ? '#fff' : '#000')} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id}
            inverted
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 16 }}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View style={[styles.messageWrapper, isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                  <View style={[styles.bubble, { backgroundColor: isUser ? currentTheme.bubbleUser : currentTheme.bubbleAI }]}>
                    <Text style={{ fontSize: 16, color: isUser ? '#ffffff' : currentTheme.textAI }}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={[styles.inputContainer, { backgroundColor: customBg ? 'rgba(0,0,0,0.7)' : currentTheme.bg }]}>
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
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  onboardContainer: { flex: 1, backgroundColor: '#fdf2f8', padding: 20, justifyContent: 'center' },
  onboardTitle: { fontSize: 36, fontWeight: '900', color: '#db2777', textAlign: 'center' },
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
  loginBtn: { backgroundColor: '#db2777', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  profilePic: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 12, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  
  messageWrapper: { maxWidth: '82%', marginVertical: 6 },
  bubble: { padding: 14, borderRadius: 20 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  inputWrapper: { flex: 1, borderRadius: 24, paddingHorizontal: 16, minHeight: 46, justifyContent: 'center' },
  input: { fontSize: 16, maxHeight: 100, paddingTop: 12, paddingBottom: 12 },
  sendButton: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 0 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  galleryBtn: { flexDirection: 'row', backgroundColor: '#db2777', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  themeBox: { width: '31%', height: 100, borderRadius: 16, padding: 8, marginBottom: 12, justifyContent: 'center' },
  themePreviewBubble: { width: '70%', height: 16, borderRadius: 8, alignSelf: 'flex-end', marginBottom: 6 }
});
