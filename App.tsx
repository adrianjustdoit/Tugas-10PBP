// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import MahasiswaScreen from './screens/MahasiswaScreen';

export type RootStackParamList = {
  Login: undefined;
  Mahasiswa: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Mahasiswa"
          component={MahasiswaScreen}
          options={{ title: 'Data Mahasiswa' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  ); 
};

export default App;
