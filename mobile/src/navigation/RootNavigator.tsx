import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCaseStore } from '../state/useCaseStore';
import { useTheme } from '../theme/ThemeProvider';

import HomeScreen from '../screens/HomeScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignInScreen from '../screens/SignInScreen';
import MyAccountScreen from '../screens/MyAccountScreen';

// Patient intake flow
import WelcomeScreen from '../screens/patient/WelcomeScreen';
import LocationPermissionScreen from '../screens/patient/LocationPermissionScreen';
import BasicDetailsScreen from '../screens/patient/BasicDetailsScreen';
import SymptomChatScreen from '../screens/patient/SymptomChatScreen';
import FollowUpQuestionsScreen from '../screens/patient/FollowUpQuestionsScreen';
import ReviewConfirmScreen from '../screens/patient/ReviewConfirmScreen';
import ConfirmationScreen from '../screens/patient/ConfirmationScreen';
import MedAIAgentScreen from '../screens/patient/MedAIAgentScreen';

// Nurse / vitals console
import PatientQueueScreen from '../screens/nurse/PatientQueueScreen';
import RecommendedTestsScreen from '../screens/nurse/RecommendedTestsScreen';
import NursePatientDetailsScreen from '../screens/nurse/NursePatientDetailsScreen';

export type RootStackParamList = {
  Home: undefined;
  SignUp: undefined;
  SignIn: { role?: 'patient' | 'nurse' } | undefined;
  MyAccount: undefined;
  Welcome: undefined;
  LocationPermission: undefined;
  BasicDetails: undefined;
  SymptomChat: undefined;
  FollowUpQuestions: undefined;
  ReviewConfirm: undefined;
  Confirmation: undefined;
  MedAIAgent: undefined;
  PatientQueue: undefined;
  NursePatientDetails: { caseId: string };
  VitalsEntry: undefined;
  Handoff: undefined;
  RecommendedTests: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Two mobile apps in one codebase: Patient Intake + Nurse Console.
 * The role selected on the RoleSelect screen decides which stack is mounted.
 */
export function RootNavigator() {
  const role = useCaseStore((s) => s.role);
  const { colors, scheme } = useTheme();

  // React Navigation chrome (backgrounds behind screens, Android nav area)
  // follows the active app theme.
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = React.useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.neutral.background,
        card: colors.neutral.surface,
        text: colors.neutral.text,
        border: colors.neutral.border,
        notification: colors.primary,
      },
    }),
    [base, colors],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        initialRouteName="Home"
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="MyAccount" component={MyAccountScreen} />

        {role === 'patient' ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
            <Stack.Screen name="BasicDetails" component={BasicDetailsScreen} />
            <Stack.Screen name="SymptomChat" component={SymptomChatScreen} />
            <Stack.Screen name="FollowUpQuestions" component={FollowUpQuestionsScreen} />
            <Stack.Screen name="ReviewConfirm" component={ReviewConfirmScreen} />
            <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
            <Stack.Screen name="MedAIAgent" component={MedAIAgentScreen} />
          </>
        ) : null}

        {role === 'nurse' ? (
          <>
            <Stack.Screen name="PatientQueue" component={PatientQueueScreen} />
            <Stack.Screen name="NursePatientDetails" component={NursePatientDetailsScreen} />
            <Stack.Screen name="RecommendedTests" component={RecommendedTestsScreen} />
          </>
        ) : null}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;