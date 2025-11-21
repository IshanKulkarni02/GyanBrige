import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, ActivityIndicator, Chip } from 'react-native-paper';
import api from '../services/api';

export default function NotesScreen({ route }) {
  const { videoId } = route.params;
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, [videoId]);

  const loadNotes = async () => {
    try {
      const response = await api.getNotes(videoId);
      setNotes(response.notes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading notes...</Text>
      </View>
    );
  }

  if (!notes) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Notes not available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.heading}>AI-Generated Notes</Text>
            <Chip
              icon="robot"
              style={styles.chip}
              textStyle={styles.chipText}
            >
              {notes.generatedBy}
            </Chip>
          </View>

          {notes.summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.text}>{notes.summary}</Text>
            </View>
          )}

          {notes.keyPoints && notes.keyPoints.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Points</Text>
              {notes.keyPoints.map((point, index) => (
                <View key={index} style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.text}>{point}</Text>
                </View>
              ))}
            </View>
          )}

          {notes.sections && notes.sections.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detailed Notes</Text>
              {notes.sections.map((section, index) => (
                <View key={index} style={styles.noteSection}>
                  <Text style={styles.noteSectionTitle}>{section.title}</Text>
                  {section.content.map((line, lineIndex) => (
                    <Text key={lineIndex} style={styles.text}>
                      {line}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          {notes.content && !notes.sections?.length && (
            <View style={styles.section}>
              <Text style={styles.text}>{notes.content}</Text>
            </View>
          )}

          <Text style={styles.timestamp}>
            Generated: {new Date(notes.timestamp || notes.createdAt).toLocaleString()}
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  card: {
    margin: 16,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  chip: {
    backgroundColor: '#2196F3',
  },
  chipText: {
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#2196F3',
    marginRight: 8,
    fontWeight: 'bold',
  },
  noteSection: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  noteSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
