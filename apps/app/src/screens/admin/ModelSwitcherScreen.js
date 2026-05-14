/**
 * Model Switcher Screen - Admin
 * Configure AI models (Ollama/ChatGPT) for the platform
 * Controls the global USE_LOCAL_AI toggle for NoteGenerator
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  getAIConfig,
  updateAIConfig,
  toggleLocalAI,
  testAIConnection,
  OPENAI_MODELS,
  OLLAMA_MODELS,
} from '../../services/ai';
import {
  Colors,
  Gradients,
  TextStyles,
  GlassStyles,
  ButtonStyles,
  Spacing,
  BorderRadius,
  LayoutStyles,
} from '../../theme';

// AI Model configurations
const AI_MODELS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    icon: '🤖',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    color: ['#10a37f', '#1a7f64'],
    description: 'OpenAI\'s powerful language models for advanced AI capabilities',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    provider: 'Local',
    icon: '🦙',
    models: ['llama3.2', 'mistral', 'codellama', 'phi3'],
    color: ['#8b5cf6', '#6366f1'],
    description: 'Run open-source LLMs locally for privacy and cost savings',
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    icon: '🧠',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    color: ['#d4a574', '#b45309'],
    description: 'Anthropic\'s AI assistant focused on safety and helpfulness',
  },
];

const ModelSwitcherScreen = () => {
  // Global AI toggle state
  const [useLocalAI, setUseLocalAI] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Model configuration
  const [openaiModel, setOpenaiModel] = useState('gpt-4-turbo-preview');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [openaiConfigured, setOpenaiConfigured] = useState(false);

  // Feature toggles
  const [features, setFeatures] = useState({
    chatbot: true,
    contentGeneration: true,
    autoGrading: false,
    translations: true,
  });

  // Load current configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const config = await getAIConfig();
      
      setUseLocalAI(config.useLocalAI);
      setOpenaiModel(config.openai?.model || 'gpt-4-turbo-preview');
      setOllamaModel(config.ollama?.model || 'llama3');
      setOpenaiConfigured(config.openai?.configured || false);
      
      if (config.ollama?.baseUrl) {
        setOllamaUrl(config.ollama.baseUrl);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      Alert.alert('Error', 'Failed to load AI configuration. Using defaults.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle the main USE_LOCAL_AI toggle
  const handleToggleLocalAI = useCallback(async () => {
    try {
      const newValue = await toggleLocalAI();
      setUseLocalAI(newValue);
      setTestResult(null);
      
      Alert.alert(
        'AI Backend Switched',
        `Now using: ${newValue ? '🦙 Ollama (Local)' : '🤖 ChatGPT (OpenAI)'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to toggle AI backend: ' + error.message);
    }
  }, []);

  // Save configuration
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      await updateAIConfig({
        useLocalAI,
        openaiModel,
        ollamaModel,
      });

      Alert.alert(
        'Configuration Saved',
        `Backend: ${useLocalAI ? 'Ollama' : 'ChatGPT'}\nModel: ${useLocalAI ? ollamaModel : openaiModel}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save configuration: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Test connection
  const handleTestConnection = async (backend = null) => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const result = await testAIConnection(backend || (useLocalAI ? 'ollama' : 'openai'));
      setTestResult(result);
      
      if (result.success) {
        Alert.alert('Connection Successful', `${result.backend} is working!\nModel: ${result.model}`);
      } else {
        Alert.alert('Connection Failed', result.error || 'Unknown error');
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message });
      Alert.alert('Error', error.message);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[LayoutStyles.screen, styles.loadingContainer]}>
        <LinearGradient
          colors={Gradients.background.colors}
          start={Gradients.background.start}
          end={Gradients.background.end}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={Colors.emeraldLight} />
        <Text style={styles.loadingText}>Loading AI Configuration...</Text>
      </View>
    );
  }

  return (
    <View style={LayoutStyles.screen}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.headerIcon}>🤖</Text>
            <View style={styles.headerInfo}>
              <Text style={TextStyles.h2}>AI Configuration</Text>
              <Text style={TextStyles.body}>Manage NoteGenerator AI backend</Text>
            </View>
          </View>
        </GlassCard>

        {/* ====== MAIN TOGGLE: USE_LOCAL_AI ====== */}
        <GlassCard style={styles.toggleCard}>
          <View style={styles.toggleHeader}>
            <Text style={styles.toggleTitle}>🎛️ USE_LOCAL_AI</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: useLocalAI ? '#8b5cf6' : '#10a37f' }
            ]}>
              <Text style={styles.statusBadgeText}>
                {useLocalAI ? 'OLLAMA' : 'CHATGPT'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.toggleDescription}>
            Toggle between local AI (Ollama) and cloud AI (ChatGPT) for generating lecture notes.
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleOption}>
              <Text style={styles.toggleOptionIcon}>🤖</Text>
              <Text style={[
                styles.toggleOptionText,
                !useLocalAI && styles.toggleOptionActive
              ]}>ChatGPT</Text>
            </View>

            <Switch
              value={useLocalAI}
              onValueChange={handleToggleLocalAI}
              trackColor={{ false: '#10a37f', true: '#8b5cf6' }}
              thumbColor={Colors.white}
              style={styles.mainSwitch}
            />

            <View style={styles.toggleOption}>
              <Text style={styles.toggleOptionIcon}>🦙</Text>
              <Text style={[
                styles.toggleOptionText,
                useLocalAI && styles.toggleOptionActive
              ]}>Ollama</Text>
            </View>
          </View>

          {/* Test Connection Button */}
          <TouchableOpacity 
            onPress={() => handleTestConnection()} 
            style={styles.testConnectionBtn}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color={Colors.emeraldLight} />
            ) : (
              <Text style={styles.testConnectionText}>
                🔗 Test {useLocalAI ? 'Ollama' : 'OpenAI'} Connection
              </Text>
            )}
          </TouchableOpacity>

          {/* Test Result */}
          {testResult && (
            <View style={[
              styles.testResult,
              { backgroundColor: testResult.success ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
            ]}>
              <Text style={[
                styles.testResultText,
                { color: testResult.success ? Colors.success : Colors.error }
              ]}>
                {testResult.success ? '✓ Connected' : '✗ Failed'}: {testResult.success ? testResult.model : testResult.error}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* ====== MODEL CONFIGURATION ====== */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>Model Configuration</Text>

        {/* ChatGPT Config */}
        <GlassCard style={[styles.configCard, useLocalAI && styles.configCardInactive]}>
          <View style={styles.configHeader}>
            <View style={styles.configTitleRow}>
              <LinearGradient colors={['#10a37f', '#1a7f64']} style={styles.configIcon}>
                <Text style={styles.configEmoji}>🤖</Text>
              </LinearGradient>
              <View>
                <Text style={TextStyles.h3}>ChatGPT (OpenAI)</Text>
                <Text style={TextStyles.bodySmall}>
                  {openaiConfigured ? '✓ API Key configured' : '✗ API Key not set'}
                </Text>
              </View>
            </View>
            {!useLocalAI && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
          </View>

          <View style={styles.configSection}>
            <Text style={TextStyles.label}>Model</Text>
            <View style={styles.subModelRow}>
              {OPENAI_MODELS.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.subModelBtn,
                    openaiModel === model.id && styles.subModelBtnActive,
                  ]}
                  onPress={() => setOpenaiModel(model.id)}
                >
                  <Text style={[
                    styles.subModelText,
                    openaiModel === model.id && styles.subModelTextActive,
                  ]}>
                    {model.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            onPress={() => handleTestConnection('openai')} 
            style={styles.testBtn}
            disabled={isTesting}
          >
            <Text style={styles.testBtnText}>Test OpenAI</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Ollama Config */}
        <GlassCard style={[styles.configCard, !useLocalAI && styles.configCardInactive]}>
          <View style={styles.configHeader}>
            <View style={styles.configTitleRow}>
              <LinearGradient colors={['#8b5cf6', '#6366f1']} style={styles.configIcon}>
                <Text style={styles.configEmoji}>🦙</Text>
              </LinearGradient>
              <View>
                <Text style={TextStyles.h3}>Ollama (Local)</Text>
                <Text style={TextStyles.bodySmall}>{ollamaUrl}</Text>
              </View>
            </View>
            {useLocalAI && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
          </View>

          <View style={styles.configSection}>
            <Text style={TextStyles.label}>Model</Text>
            <View style={styles.subModelRow}>
              {OLLAMA_MODELS.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.subModelBtn,
                    ollamaModel === model.id && styles.subModelBtnActive,
                  ]}
                  onPress={() => setOllamaModel(model.id)}
                >
                  <Text style={[
                    styles.subModelText,
                    ollamaModel === model.id && styles.subModelTextActive,
                  ]}>
                    {model.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.configSection}>
            <Text style={TextStyles.label}>Server URL</Text>
            <TextInput
              style={[GlassStyles.input, styles.input]}
              placeholder="http://localhost:11434"
              placeholderTextColor={Colors.text.muted}
              value={ollamaUrl}
              onChangeText={setOllamaUrl}
            />
          </View>

          <TouchableOpacity 
            onPress={() => handleTestConnection('ollama')} 
            style={styles.testBtn}
            disabled={isTesting}
          >
            <Text style={styles.testBtnText}>Test Ollama</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Features Toggle */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>AI Features</Text>

        <GlassCard>
          {Object.entries(features).map(([key, value]) => (
            <View key={key} style={styles.featureRow}>
              <View style={styles.featureInfo}>
                <Text style={TextStyles.label}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Text>
                <Text style={TextStyles.bodySmall}>
                  {getFeatureDescription(key)}
                </Text>
              </View>
              <Switch
                value={value}
                onValueChange={(newValue) => setFeatures({ ...features, [key]: newValue })}
                trackColor={{ false: Colors.glass.background, true: Colors.emerald }}
                thumbColor={value ? Colors.emeraldLight : Colors.text.muted}
              />
            </View>
          ))}
        </GlassCard>

        {/* Save Button */}
        <TouchableOpacity onPress={handleSave} style={styles.saveWrapper} disabled={isSaving}>
          <LinearGradient
            colors={Gradients.primary.colors}
            style={[ButtonStyles.primary, styles.saveBtn]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={ButtonStyles.primaryText}>Save Configuration</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Card */}
        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 About USE_LOCAL_AI</Text>
          <Text style={styles.infoText}>
            When enabled, the NoteGenerator service uses Ollama running locally on your machine. 
            This provides privacy and works offline, but requires Ollama to be installed and running.
          </Text>
          <Text style={styles.infoText}>
            When disabled, it uses OpenAI's ChatGPT API which requires an internet connection 
            and a valid API key, but provides more powerful models.
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const getFeatureDescription = (key) => {
  const descriptions = {
    chatbot: 'AI-powered chatbot for student queries',
    contentGeneration: 'Generate quizzes and study materials',
    autoGrading: 'Automatic grading of assignments',
    translations: 'Multi-language content translation',
  };
  return descriptions[key] || '';
};

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text.muted,
    marginTop: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  headerCard: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 36,
    marginRight: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },

  // Main toggle card
  toggleCard: {
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.emeraldLight,
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  toggleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleDescription: {
    fontSize: 14,
    color: Colors.text.muted,
    marginBottom: Spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  toggleOption: {
    alignItems: 'center',
    width: 100,
  },
  toggleOptionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  toggleOptionText: {
    fontSize: 14,
    color: Colors.text.muted,
  },
  toggleOptionActive: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  mainSwitch: {
    transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }],
    marginHorizontal: Spacing.lg,
  },
  testConnectionBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  testConnectionText: {
    color: Colors.emeraldLight,
    fontWeight: '500',
  },
  testResult: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  testResultText: {
    fontSize: 13,
    textAlign: 'center',
  },

  // Config cards
  configCard: {
    marginBottom: Spacing.md,
  },
  configCardInactive: {
    opacity: 0.6,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  configTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  configEmoji: {
    fontSize: 22,
  },
  activeBadge: {
    backgroundColor: Colors.emerald,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  activeBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  configSection: {
    marginBottom: Spacing.md,
  },
  input: {
    marginTop: Spacing.sm,
  },
  subModelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  subModelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  subModelBtnActive: {
    backgroundColor: Colors.emerald,
    borderColor: Colors.emerald,
  },
  subModelText: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  subModelTextActive: {
    color: Colors.white,
  },
  testBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  testBtnText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  featureInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  saveWrapper: {
    marginTop: Spacing.lg,
  },
  saveBtn: {
    width: '100%',
  },
  infoCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    color: Colors.text.muted,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
});

export default ModelSwitcherScreen;
