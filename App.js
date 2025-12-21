import { useState, useEffect } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard, ScrollView, Platform, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs(['expo-notifications:']); // Silence warnings

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
  
  // STATES
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState(null);
  
  // ALERT ARRAY: Stores ['notification', 'alarm']
  const [activeAlerts, setActiveAlerts] = useState([]); 

  useEffect(() => {
    async function loadTasks() {
      try {
        const savedTasks = await AsyncStorage.getItem('myTasks');
        if (savedTasks !== null) setTaskItems(JSON.parse(savedTasks)); 
      } catch (error) { console.log(error); }
    }
    
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
    }
    loadTasks();
    setupNotifications();
  }, []);

  const saveTasksToPhone = async (newItems) => {
    try { await AsyncStorage.setItem('myTasks', JSON.stringify(newItems)); } 
    catch (error) { console.log(error); }
  }

  // --- FIXED TOGGLE LOGIC ---
  const toggleAlert = (type) => {
    // 1. Create a copy of the current list
    let currentList = [...activeAlerts];

    // 2. Check if the type (e.g., 'alarm') is already in the list
    if (currentList.includes(type)) {
      // REMOVE IT (Filter it out)
      currentList = currentList.filter(item => item !== type);
    } else {
      // ADD IT
      currentList.push(type);
      
      // If no time is set yet, open the picker
      if (!reminderTime) setShowPicker(true);
    }

    // 3. Save the new list
    setActiveAlerts(currentList);
    
    // 4. If list becomes empty, maybe clear time? (Optional, kept safe here)
    if (currentList.length === 0) setReminderTime(null);
  };

  const onChangeTime = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setReminderTime(selectedDate);
    } else {
      // If cancelled and no time set, clear selections
      if (!reminderTime) setActiveAlerts([]);
    }
  };

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (task) {
      const newTask = { 
        text: task, 
        time: reminderTime, 
        alertTypes: activeAlerts // Saves both if both selected
      };
      
      const newItems = [...taskItems, newTask];
      setTaskItems(newItems);
      saveTasksToPhone(newItems);
      
      // Schedule Alerts
      if (reminderTime && activeAlerts.length > 0) {
        activeAlerts.forEach(type => {
          scheduleAlarm(task, reminderTime, type);
        });
      }
      
      // Reset
      setTask(null);
      setReminderTime(null);
      setActiveAlerts([]);
    }
  }

  const completeTask = (index) => {
    let itemsCopy = [...taskItems];
    itemsCopy.splice(index, 1);
    setTaskItems(itemsCopy);
    saveTasksToPhone(itemsCopy);
  }

  const scheduleAlarm = async (taskName, triggerDate, type) => {
    const now = new Date();
    const triggerInSeconds = (triggerDate.getTime() - now.getTime()) / 1000;
    if (triggerInSeconds <= 0) return;

    const title = type === 'alarm' ? "⏰ ALARM!" : "✨ Reminder";
    const body = type === 'alarm' ? `URGENT: ${taskName}` : `Don't forget: ${taskName}`;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { type: 'timeInterval', seconds: triggerInSeconds, channelId: 'default' },
    });
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
                          {/* SHOW ICONS */}
                          {item.time && (
                             <View style={styles.timeContainer}>
                               {item.alertTypes?.includes('notification') && <Text style={styles.iconSmall}>🔔</Text>}
                               {item.alertTypes?.includes('alarm') && <Text style={styles.iconSmall}>⏰</Text>}
                               <Text style={styles.timeText}>
                                 {new Date(item.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </Text>
                             </View>
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
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 20}
        style={styles.writeTaskWrapper}
      >
        <TextInput style={styles.input} placeholder={'Write a task'} value={task} onChangeText={text => setTask(text)} />
        
        {/* BUTTON 1: Notification */}
        <TouchableOpacity 
          onPress={() => toggleAlert('notification')} 
          style={[
            styles.iconButton, 
            activeAlerts.includes('notification') ? {backgroundColor: '#AEC6CF', borderWidth: 2, borderColor: '#fff'} : null
          ]}
        >
           <Text style={styles.iconText}>🔔</Text>
        </TouchableOpacity>

        {/* BUTTON 2: Alarm */}
        <TouchableOpacity 
          onPress={() => toggleAlert('alarm')} 
          style={[
            styles.iconButton, 
            activeAlerts.includes('alarm') ? {backgroundColor: '#FFDAB9', borderWidth: 2, borderColor: '#fff'} : null
          ]}
        >
           <Text style={styles.iconText}>⏰</Text>
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
  timeContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  iconSmall: { fontSize: 12, marginRight: 4 },
  timeText: { fontSize: 12, color: '#888', fontWeight: 'bold' }, 
  circular: { width: 12, height: 12, borderColor: '#FFDAB9', borderWidth: 2, borderRadius: 5 },
  writeTaskWrapper: { position: 'absolute', bottom: 30, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  input: { paddingVertical: 15, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 60, borderColor: '#C0C0C0', borderWidth: 1, width: 180 }, 
  addWrapper: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderColor: '#C0C0C0', borderWidth: 1 },
  addText: {},
  iconButton: { width: 45, height: 45, backgroundColor: '#E6E6FA', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 18 }
});