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
  
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  
  const [notificationTime, setNotificationTime] = useState(null);
  const [alarmTime, setAlarmTime] = useState(null);
  
  const [editingType, setEditingType] = useState(null); 

  useEffect(() => {
    async function loadTasks() {
      try {
        const savedTasks = await AsyncStorage.getItem('myTasks');
        if (savedTasks !== null) setTaskItems(JSON.parse(savedTasks)); 
      } catch (error) { console.log(error); }
    }
    
    async function setupNotifications() {
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (Platform.OS === 'android') {
        // 1. STANDARD REMINDER (Gentle)
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Standard Reminder',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250], // Soft buzz
        });

        // 2. URGENT ALARM (Sharp Beep-Beep-Beep feel)
        await Notifications.setNotificationChannelAsync('alarm-channel', {
          name: 'High Priority Alarm',
          importance: Notifications.AndroidImportance.MAX,
          // 0ms delay, 100ms buzz, 50ms pause, 100ms buzz... (Fast & Aggressive)
          vibrationPattern: [0, 100, 50, 100, 50, 100, 50, 100, 50, 100], 
          lightColor: '#FF231F7C',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }
    }
    loadTasks();
    setupNotifications();
  }, []);

  const saveTasksToPhone = async (newItems) => {
    try { await AsyncStorage.setItem('myTasks', JSON.stringify(newItems)); } 
    catch (error) { console.log(error); }
  }

  const handleIconPress = (type) => {
    if (type === 'notification' && notificationTime) { setNotificationTime(null); return; }
    if (type === 'alarm' && alarmTime) { setAlarmTime(null); return; }
    setEditingType(type);
    setShowPicker(true);
  };

  const onChangeTime = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      if (editingType === 'notification') setNotificationTime(selectedDate);
      else if (editingType === 'alarm') setAlarmTime(selectedDate);
    }
    setEditingType(null);
  };

  const handleAddTask = () => {
    Keyboard.dismiss();
    if (task) {
      const newTask = { 
        text: task, 
        notificationTime: notificationTime,
        alarmTime: alarmTime
      };
      
      const newItems = [...taskItems, newTask];
      setTaskItems(newItems);
      saveTasksToPhone(newItems);
      
      if (notificationTime) scheduleAlarm(task, notificationTime, 'notification');
      if (alarmTime)        scheduleAlarm(task, alarmTime, 'alarm');
      
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

    const isAlarm = type === 'alarm';
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isAlarm ? "⏰ ALARM!" : "✨ Reminder",
        body: isAlarm ? `ALARM: ${taskName}` : `Don't forget: ${taskName}`,
        sound: 'default', // Custom sounds require standalone build
        sticky: isAlarm, 
        priority: isAlarm ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: 'timeInterval',
        seconds: triggerInSeconds,
        channelId: isAlarm ? 'alarm-channel' : 'default', 
      },
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
                          <View style={{marginTop: 5}}>
                            {item.notificationTime && (
                              <View style={styles.timeRow}>
                                <Text style={styles.iconSmall}>🔔</Text>
                                <Text style={styles.timeText}>
                                  {new Date(item.notificationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </Text>
                              </View>
                            )}
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
        
        <TouchableOpacity 
          onPress={() => handleIconPress('notification')} 
          style={[styles.iconButton, notificationTime ? {backgroundColor: '#AEC6CF', borderWidth: 2, borderColor: '#fff'} : null]}
        >
           <Text style={styles.iconText}>🔔</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => handleIconPress('alarm')} 
          style={[styles.iconButton, alarmTime ? {backgroundColor: '#FFDAB9', borderWidth: 2, borderColor: '#fff'} : null]}
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