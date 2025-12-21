import { useState, useEffect } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View, TextInput, TouchableOpacity, Keyboard, ScrollView, Platform, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs(['expo-notifications:']);

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
  
  // STATES FOR INDEPENDENT TIMES
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  
  // We now store TWO separate times
  const [notificationTime, setNotificationTime] = useState(null); // For 🔔
  const [alarmTime, setAlarmTime] = useState(null);               // For ⏰
  
  // Tracks which button opened the picker ('notification' or 'alarm')
  const [editingType, setEditingType] = useState(null); 

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

  // --- NEW LOGIC FOR INDEPENDENT TIMES ---
  const handleIconPress = (type) => {
    // 1. If we click a button that already has a time set, we CLEAR it (Toggle Off)
    if (type === 'notification' && notificationTime) {
      setNotificationTime(null);
      return;
    }
    if (type === 'alarm' && alarmTime) {
      setAlarmTime(null);
      return;
    }

    // 2. Otherwise, we open the picker for that specific type
    setEditingType(type); // Remember what we are editing
    setShowPicker(true);
  };

  const onChangeTime = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate); // Sync calendar position
      
      // Save to the correct state variable
      if (editingType === 'notification') {
        setNotificationTime(selectedDate);
      } else if (editingType === 'alarm') {
        setAlarmTime(selectedDate);
      }
    }
    // Reset editing type
    setEditingType(null);
  };

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (task) {
      // We save both times into the task object
      const newTask = { 
        text: task, 
        notificationTime: notificationTime, // Date or null
        alarmTime: alarmTime                // Date or null
      };
      
      const newItems = [...taskItems, newTask];
      setTaskItems(newItems);
      saveTasksToPhone(newItems);
      
      // Schedule Alerts independently
      if (notificationTime) scheduleAlarm(task, notificationTime, 'notification');
      if (alarmTime)        scheduleAlarm(task, alarmTime, 'alarm');
      
      // Reset everything
      setTask(null);
      setNotificationTime(null);
      setAlarmTime(null);
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
                          
                          {/* SHOW TIMES (Render separate rows if both exist) */}
                          <View style={{marginTop: 5}}>
                            {/* Notification Row */}
                            {item.notificationTime && (
                              <View style={styles.timeRow}>
                                <Text style={styles.iconSmall}>🔔</Text>
                                <Text style={styles.timeText}>
                                  {new Date(item.notificationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </Text>
                              </View>
                            )}
                            
                            {/* Alarm Row */}
                            {item.alarmTime && (
                              <View style={styles.timeRow}>
                                <Text style={styles.iconSmall}>⏰</Text>
                                <Text style={[styles.timeText, {color: '#FF6347'}]}>
                                  {new Date(item.alarmTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </Text>
                              </View>
                            )}
                          </View>

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
        
        {/* BUTTON 1: Notification (Bell) */}
        <TouchableOpacity 
          onPress={() => handleIconPress('notification')} 
          style={[
            styles.iconButton, 
            // If notificationTime is set, turn Blue
            notificationTime ? {backgroundColor: '#AEC6CF', borderWidth: 2, borderColor: '#fff'} : null
          ]}
        >
           <Text style={styles.iconText}>🔔</Text>
        </TouchableOpacity>

        {/* BUTTON 2: Alarm (Clock) */}
        <TouchableOpacity 
          onPress={() => handleIconPress('alarm')} 
          style={[
            styles.iconButton, 
            // If alarmTime is set, turn Orange
            alarmTime ? {backgroundColor: '#FFDAB9', borderWidth: 2, borderColor: '#fff'} : null
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
  
  // Updated Time Rows
  timeRow: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginTop: 2 },
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