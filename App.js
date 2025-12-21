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
// Import Vector Icons
import { Feather } from '@expo/vector-icons'; 

LogBox.ignoreLogs(['expo-notifications:']);

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

const CARD_COLORS = [
  '#FFD1DC', '#FFDAC1', '#FFF5BA', '#C1E1C1', 
  '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FF9AA2', 
];

const TaskItem = ({ item, onDelete, onComplete }) => {
  const [isChecked, setIsChecked] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current; 
  const [action, setAction] = useState(null); 

  const handleComplete = () => {
    if (isChecked) return; 
    
    // 1. Show the Tick immediately
    setIsChecked(true);
    setAction('complete'); 

    // 2. WAIT 300ms so the user actually sees the tick
    setTimeout(() => {
      // 3. NOW start the slide animation
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH, 
        duration: 400, 
        useNativeDriver: true,
        easing: Easing.out(Easing.poly(4)), 
      }).start(() => {
        // 4. Finally remove the data
        setTimeout(() => {
          onComplete(item.id); 
        }, 200);
      });
    }, 300); // <--- The "Pause to admire the tick" delay
  };

  const handleDelete = () => {
    setAction('delete'); 
    
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH, 
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.poly(4)),
    }).start(() => {
      setTimeout(() => {
        onDelete(item.id);
      }, 200);
    });
  };

  return (
    <View style={[
      styles.taskContainerBackground, 
      action === 'complete' ? { backgroundColor: '#4CAF50' } : 
      action === 'delete' ? { backgroundColor: '#FF6347' } : 
      { backgroundColor: 'transparent' } 
    ]}>
      
      {action === 'complete' && <View style={styles.bgTextContainerLeft}><Text style={styles.bgText}>Completed</Text></View>}
      {action === 'delete' && <View style={styles.bgTextContainerRight}><Text style={styles.bgText}>Deleted</Text></View>}

      <Animated.View style={{ transform: [{ translateX }] }}>
        <View style={[styles.item, { backgroundColor: item.color || '#FFF' }]}>
          <View style={styles.itemLeft}>
            
            <TouchableOpacity 
              style={[styles.square, isChecked && styles.squareChecked]} 
              onPress={handleComplete}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              {/* Ensure tick is visible only when checked */}
              {isChecked && <Feather name="check" size={16} color="#FFF" />}
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

          <TouchableOpacity 
            onPress={handleDelete} 
            style={styles.trashContainer}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Feather name="trash-2" size={20} color="#FF6347" />
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
    setDate(new Date()); 
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      let randomColor;
      let lastColor = null;
      if (taskItems.length > 0) lastColor = taskItems[taskItems.length - 1].color;
      const availableColors = CARD_COLORS.filter(color => color !== lastColor);
      randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];

      const newTask = { 
        id: Date.now().toString(), 
        text: task, 
        notificationTime: notificationTime,
        alarmTime: alarmTime,
        color: randomColor 
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

  const deleteTask = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTaskItems(prevItems => {
      const updatedItems = prevItems.filter(item => item.id !== id);
      saveTasksToPhone(updatedItems); 
      return updatedItems;
    });
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
      
      <View style={styles.headerWrapper}>
        <Text style={styles.sectionTitle}>My Daily Tasks ✨</Text>
      </View>
      
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100, paddingHorizontal: 20 }} 
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.items}>
          {taskItems.map((item) => {
            return (
              <TaskItem 
                key={item.id} 
                item={item}
                onDelete={deleteTask}
                onComplete={deleteTask}
              />
            )
          })}
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
            {/* 2. REPLACED TEXT WITH ICON */}
            <Feather name="plus" size={30} color="#C0C0C0" />
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
  headerWrapper: { paddingTop: 80, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#FDFCF0', zIndex: 1 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: '#6A5ACD' },
  items: { marginTop: 0 },
  taskContainerBackground: { marginBottom: 20, borderRadius: 15, overflow: 'hidden', justifyContent: 'center' },
  bgTextContainerLeft: { position: 'absolute', left: 20, zIndex: 0 },
  bgTextContainerRight: { position: 'absolute', right: 20, zIndex: 0 },
  bgText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
  item: { padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 }, 
  
  // CHECKBOX STYLE
  square: { width: 24, height: 24, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 5, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  squareChecked: { backgroundColor: '#4CAF50', opacity: 1 },
  
  // Note: Removed "tick" style since we use Vector Icon now
  textCompleted: { textDecorationLine: 'line-through', color: '#666' },
  itemText: { fontSize: 16, color: '#333' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginTop: 2 },
  iconSmall: { fontSize: 12, marginRight: 4 },
  timeText: { fontSize: 12, color: '#555', fontWeight: 'bold' }, 
  trashContainer: { padding: 5 },
  writeTaskWrapper: { position: 'absolute', bottom: 30, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  input: { paddingVertical: 15, paddingHorizontal: 15, backgroundColor: '#FFF', borderRadius: 60, borderColor: '#C0C0C0', borderWidth: 1, width: 180 }, 
  addWrapper: { width: 50, height: 50, backgroundColor: '#FFF', borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderColor: '#C0C0C0', borderWidth: 1 },
  iconButton: { width: 45, height: 45, backgroundColor: '#E6E6FA', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 18 },
});