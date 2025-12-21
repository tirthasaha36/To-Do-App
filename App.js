import { useState, useEffect, useRef } from 'react';
import { 
  KeyboardAvoidingView, StyleSheet, Text, View, TextInput, TouchableOpacity, 
  Keyboard, ScrollView, Platform, LogBox, Animated, Easing, Dimensions, 
  LayoutAnimation, UIManager 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs(['expo-notifications:']);

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const SCREEN_WIDTH = Dimensions.get('window').width;

// --- TASK ITEM COMPONENT ---
const TaskItem = ({ item, index, onDelete, onComplete }) => {
  const [isChecked, setIsChecked] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current; 
  
  // Track which action is happening to show correct text
  const [action, setAction] = useState(null); // 'complete' or 'delete'

  const handleComplete = () => {
    if (isChecked) return; 
    setIsChecked(true);
    setAction('complete'); // Show Green + Text

    Animated.timing(translateX, {
      toValue: SCREEN_WIDTH, 
      duration: 350, // Slightly faster for snappier feel
      useNativeDriver: true,
      easing: Easing.out(Easing.poly(4)), // Ultra smooth easing
    }).start(() => {
      onComplete(index); 
    });
  };

  const handleDelete = () => {
    setAction('delete'); // Show Red + Text
    
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH, 
      duration: 350,
      useNativeDriver: true,
      easing: Easing.out(Easing.poly(4)),
    }).start(() => {
      onDelete(index);
    });
  };

  return (
    // THE BACKGROUND LAYER (Revealed when card slides)
    <View style={[
      styles.taskContainerBackground, 
      // Change color based on action
      action === 'complete' ? { backgroundColor: '#4CAF50' } : 
      action === 'delete' ? { backgroundColor: '#FF6347' } : 
      { backgroundColor: '#FFF' } 
    ]}>
      
      {/* TEXT: "Completed" (Visible on Left side) */}
      {action === 'complete' && (
        <View style={styles.bgTextContainerLeft}>
          <Text style={styles.bgText}>Completed</Text>
        </View>
      )}

      {/* TEXT: "Deleted" (Visible on Right side) */}
      {action === 'delete' && (
        <View style={styles.bgTextContainerRight}>
          <Text style={styles.bgText}>Deleted</Text>
        </View>
      )}

      {/* THE WHITE CARD (Slides over the background) */}
      <Animated.View style={{ transform: [{ translateX }] }}>
        <View style={styles.item}>
          <View style={styles.itemLeft}>
            <TouchableOpacity style={[styles.square, isChecked && styles.squareChecked]} onPress={handleComplete}>
              {isChecked && <Text style={styles.tick}>✓</Text>}
            </TouchableOpacity>
            
            <View>
              <Text style={[styles.itemText, isChecked && styles.textCompleted]}>{item.text}</Text>
              <View style={{ marginTop: 5 }}>
                {item.notificationTime && (
                  <View style={styles.timeRow}>
                    <Text style={styles.iconSmall}>🔔</Text>
                    <Text style={styles.timeText}>
                      {new Date(item.notificationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
                {item.alarmTime && (
                  <View style={styles.timeRow}>
                    <Text style={styles.iconSmall}>⏰</Text>
                    <Text style={[styles.timeText, { color: '#FF6347' }]}>
                      {new Date(item.alarmTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={handleDelete} style={styles.trashContainer}>
            <Text style={styles.trashIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

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
        if (savedTasks !== null) {
          let loaded = JSON.parse(savedTasks);
          loaded = loaded.map(t => t.id ? t : { ...t, id: Math.random().toString() });
          setTaskItems(loaded); 
        }
      } catch (error) { console.log(error); }
    }
    async function setupNotifications() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Standard Reminder',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
        });
        await Notifications.setNotificationChannelAsync('alarm-channel', {
          name: 'High Priority Alarm',
          importance: Notifications.AndroidImportance.MAX,
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
      // Configure animation for ADDING a task
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      const newTask = { 
        id: Date.now().toString(), 
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

  const deleteTask = (index) => {
    // CRITICAL: This makes the list fill the gap smoothly
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    
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
        sound: 'default',
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
      
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} keyboardShouldPersistTaps='handled'>
        <View style={styles.tasksWrapper}>
          <Text style={styles.sectionTitle}>My Daily Tasks ✨</Text>

          <View style={styles.items}>
            {taskItems.map((item, index) => {
              return (
                <TaskItem 
                  key={item.id} 
                  index={index}
                  item={item}
                  onDelete={deleteTask}
                  onComplete={deleteTask}
                />
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
  
  // --- BACKGROUND CONTAINER ---
  taskContainerBackground: {
    marginBottom: 20, 
    borderRadius: 15,
    overflow: 'hidden',
    justifyContent: 'center', // Centers the text vertically
  },
  
  // --- BACKGROUND TEXT ---
  bgTextContainerLeft: { position: 'absolute', left: 20, zIndex: 0 },
  bgTextContainerRight: { position: 'absolute', right: 20, zIndex: 0 },
  bgText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  item: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 }, 
  square: { width: 24, height: 24, backgroundColor: '#AEC6CF', opacity: 0.4, borderRadius: 5, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  squareChecked: { backgroundColor: '#4CAF50', opacity: 1 },
  tick: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  textCompleted: { textDecorationLine: 'line-through', color: '#D3D3D3' },
  itemText: { fontSize: 16, color: '#333' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginTop: 2 },
  iconSmall: { fontSize: 12, marginRight: 4 },
  timeText: { fontSize: 12, color: '#888', fontWeight: 'bold' }, 
  trashContainer: { padding: 5 },
  trashIcon: { fontSize: 20, opacity: 0.5 },
  writeTaskWrapper: { position: 'absolute', bottom: 30, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  input: { paddingVertical: 15, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 60, borderColor: '#C0C0C0', borderWidth: 1, width: 180 }, 
  addWrapper: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderColor: '#C0C0C0', borderWidth: 1 },
  addText: {},
  iconButton: { width: 45, height: 45, backgroundColor: '#E6E6FA', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 18 },
});