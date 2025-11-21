import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, Card, ActivityIndicator, IconButton } from 'react-native-paper';
import api from '../services/api';

export default function SubjectsScreen({ navigation }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/subjects`, {
        headers: { 'x-user-role': 'admin' }
      });
      const data = await response.json();
      setSubjects(data.subjects || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSubject = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('SubjectVideos', { subject: item })}
      style={styles.subjectCard}
    >
      <View style={[styles.colorBar, { backgroundColor: item.color || '#2196F3' }]} />
      <View style={styles.subjectContent}>
        <View style={styles.subjectInfo}>
          <Text style={styles.subjectName}>{item.name}</Text>
          <Text style={styles.subjectCode}>{item.code}</Text>
          {item.description && (
            <Text style={styles.subjectDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        <IconButton
          icon="chevron-right"
          size={24}
          iconColor="#666"
        />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading subjects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Subjects</Text>
        <Text style={styles.headerSubtitle}>Choose a subject to view lessons</Text>
      </View>

      <FlatList
        data={subjects}
        renderItem={renderSubject}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No subjects available</Text>
            <Text style={styles.emptySubtext}>Contact your teacher or admin</Text>
          </View>
        }
      />
    </View>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#030303',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  colorBar: {
    height: 6,
    width: '100%',
  },
  subjectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#030303',
    marginBottom: 4,
  },
  subjectCode: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 8,
  },
  subjectDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
