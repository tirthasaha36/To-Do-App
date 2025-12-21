import { useState, useEffect } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard, ScrollView, Platform, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage'; // <--- NEW IMPORT

// Silence the annoying warnings
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'functionality is not fully supported in Expo Go'
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [task, setTask] = useState();
  const [taskItems, setTaskItems] = useState([]);
  
  // Date Picker States
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState(null);

  // 1. LOAD TASKS ON STARTUP
  useEffect(() => {
    async function loadTasks() {
      try {
        const savedTasks = await AsyncStorage.getItem('myTasks');
        if (savedTasks !== null) {
          // We stored it as text (JSON), so we turn it back into an array
          setTaskItems(JSON.parse(savedTasks)); 
        }
      } catch (error) {
        console.log("Error loading tasks:", error);
      }
    }

    // Setup Notifications
    async function setupNotifications() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') alert('Permission failed!');
    }

    loadTasks(); // Load data
    setupNotifications(); // Setup alarms
  }, []);

  // 2. SAVE FUNCTION (Helper)
  const saveTasksToPhone = async (newItems) => {
    try {
      // We must turn the array into a string (JSON) to save it
      await AsyncStorage.setItem('myTasks', JSON.stringify(newItems));
    } catch (error) {
      console.log("Error saving tasks:", error);
    }
  }

  const onChangeTime = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowPicker(false); 
    setDate(currentDate);
    setReminderTime(currentDate);
  };

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (task) {
      const newTask = { text: task, time: reminderTime };
      const newItems = [...taskItems, newTask];
      
      setTaskItems(newItems); // Update Screen
      saveTasksToPhone(newItems); // Update Storage 💾
      
      if (reminderTime) {
        scheduleAlarm(task, reminderTime);
      }
      
      setTask(null);
      setReminderTime(null);
    }
  }

  const completeTask = (index) => {
    let itemsCopy = [...taskItems];
    itemsCopy.splice(index, 1);
    
    setTaskItems(itemsCopy); // Update Screen
    saveTasksToPhone(itemsCopy); // Update Storage 💾
  }

  const scheduleAlarm = async (taskName, triggerDate) => {
    const now = new Date();
    const triggerInSeconds = (triggerDate.getTime() - now.getTime()) / 1000;

    if (triggerInSeconds <= 0) {
      alert("Time is in the past!");
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✨ It's Time!",
        body: `Don't forget to: ${taskName}`,
        sound: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: triggerInSeconds,
        channelId: 'default',
      },
    });
    alert(`Alarm set for ${triggerDate.toLocaleTimeString()}!`);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps='handled'>
        <View style={styles.tasksWrapper}>
          <Text style={styles.sectionTitle}>My Daily Tasks ✨</Text>

          <View style={styles.items}>
            {taskItems.map((item, index) => {
              return (
                <TouchableOpacity key={index}  onPress={() => completeTask(index)}>
                   <View style={styles.item}>
                      <View style={styles.itemLeft}>
                        <View style={styles.square}></View>
                        <View>
                          <Text style={styles.itemText}>{item.text}</Text>
                          {/* Note: Dates loaded from storage come back as STRINGS, so we check formatting */}
                          {item.time && (
                             <Text style={styles.timeText}>
                               ⏰ {new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.circular}></View>
                   </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </ScrollView>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "padding"} // Changed 'height' to 'padding'
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 20} // Adds a little spacing buffer
        style={styles.writeTaskWrapper}
      >
        <TextInput style={styles.input} placeholder={'Write a task'} value={task} onChangeText={text => setTask(text)} />
        
        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.clockButton}>
           <Text style={styles.clockText}>{reminderTime ? "✅" : "⏰"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleAddTask()}>
          <View style={styles.addWrapper}>
            <Text style={styles.addText}>+</Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {showPicker && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onChangeTime}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCF0' },
  tasksWrapper: { paddingTop: 80, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#6A5ACD', marginBottom: 20 },
  items: { marginTop: 10 },
  item: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  square: { width: 24, height: 24, backgroundColor: '#AEC6CF', opacity: 0.4, borderRadius: 5, marginRight: 15 },
  itemText: { maxWidth: '80%', fontSize: 16, color: '#333' },
  timeText: { fontSize: 12, color: '#888', marginTop: 3 },
  circular: { width: 12, height: 12, borderColor: '#FFDAB9', borderWidth: 2, borderRadius: 5 },
  writeTaskWrapper: { position: 'absolute', bottom: 30, width: '100%', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  input: { paddingVertical: 15, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 60, borderColor: '#C0C0C0', borderWidth: 1, width: 200 },
  addWrapper: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderColor: '#C0C0C0', borderWidth: 1 },
  addText: {},
  clockButton: { width: 50, height: 50, backgroundColor: '#E6E6FA', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  clockText: { fontSize: 20 }
});