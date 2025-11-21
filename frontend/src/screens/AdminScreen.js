import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, DataTable, Chip, FAB, Portal, Dialog, TextInput, SegmentedButtons } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function AdminScreen() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [userDialog, setUserDialog] = useState({ visible: false, user: null });
  const [createUserDialog, setCreateUserDialog] = useState({ visible: false });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student' });
  const [subjectDialog, setSubjectDialog] = useState({ visible: false, subject: null });
  const [newSubject, setNewSubject] = useState({ name: '', code: '', description: '', color: '#2196F3' });
  const [teacherDialog, setTeacherDialog] = useState({ visible: false, subject: null });
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        await loadStats();
      } else if (activeTab === 'users') {
        await loadUsers();
      } else if (activeTab === 'subjects') {
        await loadSubjects();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/stats/overview`, {
        headers: { 'x-user-role': 'admin' }
      });
      const data = await response.json();
      setStats(data.stats || {});
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/users`, {
        headers: { 'x-user-role': 'admin' }
      });
      const data = await response.json();
      setUsers(data.users || []);
      // Filter teachers for subject assignment
      setTeachers(data.users.filter(u => u.role === 'teacher' || u.role === 'admin') || []);
    } catch (error) {
      console.error('Users error:', error);
    }
  };

  const loadSubjects = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/subjects`, {
        headers: { 'x-user-role': 'admin' }
      });
      const data = await response.json();
      setSubjects(data.subjects || []);
    } catch (error) {
      console.error('Subjects error:', error);
    }
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      const response = await api.register(newUser.name, newUser.email, newUser.password, newUser.role);
      Alert.alert('Success', `User ${newUser.name} created successfully!`);
      setCreateUserDialog({ visible: false });
      setNewUser({ name: '', email: '', password: '', role: 'student' });
      loadUsers();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create user');
    }
  };

  const assignTeachersToSubject = async (subjectId, teacherIds) => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/subjects/${subjectId}/teachers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify({ teachers: teacherIds })
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Teachers assigned successfully!');
        setTeacherDialog({ visible: false, subject: null });
        loadSubjects();
      } else {
        Alert.alert('Error', 'Failed to assign teachers');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to assign teachers');
    }
  };

  const createSubject = async () => {
    if (!newSubject.name || !newSubject.code) {
      Alert.alert('Error', 'Please fill name and code');
      return;
    }

    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/subjects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify(newSubject)
      });
      
      if (response.ok) {
        Alert.alert('Success', `Subject ${newSubject.name} created!`);
        setSubjectDialog({ visible: false, subject: null });
        setNewSubject({ name: '', code: '', description: '', color: '#2196F3' });
        loadSubjects();
      } else {
        Alert.alert('Error', 'Failed to create subject');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create subject');
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify({ role: newRole })
      });
      
      if (response.ok) {
        Alert.alert('Success', 'User role updated');
        loadUsers();
      } else {
        Alert.alert('Error', 'Failed to update user role');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update user role');
    }
    setUserDialog({ visible: false, user: null });
  };

  const renderOverview = () => (
    <ScrollView>
      <Card style={styles.card}>
        <Card.Title title="System Overview" subtitle="GyanBrige Statistics" />
        <Card.Content>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.users || 0}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.videos || 0}</Text>
              <Text style={styles.statLabel}>Total Videos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.subjects || 0}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.readyVideos || 0}</Text>
              <Text style={styles.statLabel}>Ready Videos</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
      
      <Card style={styles.card}>
        <Card.Content>
          <Button 
            mode="outlined" 
            onPress={logout}
            icon="logout"
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={styles.container}>
      <Button
        mode="contained"
        icon="account-plus"
        onPress={() => setCreateUserDialog({ visible: true })}
        style={styles.addButton}
      >
        Add New User
      </Button>
      
      <DataTable>
        <DataTable.Header>
          <DataTable.Title>Name</DataTable.Title>
          <DataTable.Title>Email</DataTable.Title>
          <DataTable.Title>Role</DataTable.Title>
          <DataTable.Title>Actions</DataTable.Title>
        </DataTable.Header>

        {users.map(u => (
          <DataTable.Row key={u._id}>
            <DataTable.Cell>{u.name}</DataTable.Cell>
            <DataTable.Cell>{u.email}</DataTable.Cell>
            <DataTable.Cell>
              <Chip
                mode="outlined"
                style={[
                  styles.roleChip,
                  u.role === 'admin' && styles.adminChip,
                  u.role === 'teacher' && styles.teacherChip,
                  u.role === 'student' && styles.studentChip
                ]}
              >
                {u.role}
              </Chip>
            </DataTable.Cell>
            <DataTable.Cell>
              <Button
                mode="text"
                onPress={() => setUserDialog({ visible: true, user: u })}
              >
                Edit
              </Button>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
      </DataTable>
    </View>
  );

  const renderSubjects = () => (
    <ScrollView>
      <Button
        mode="contained"
        icon="book-plus"
        onPress={() => setSubjectDialog({ visible: true, subject: null })}
        style={styles.addButton}
      >
        Add New Subject
      </Button>

      {subjects.map(subject => (
        <Card key={subject._id} style={styles.card}>
          <Card.Content>
            <View style={styles.subjectHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectCode}>{subject.code}</Text>
                {subject.description && <Text style={styles.subjectDescription}>{subject.description}</Text>}
                
                {/* Show assigned teachers */}
                {subject.teachers && subject.teachers.length > 0 && (
                  <View style={styles.teachersList}>
                    <Text style={styles.teachersLabel}>Teachers:</Text>
                    {subject.teachers.map((teacher, idx) => (
                      <Chip key={idx} style={styles.teacherChip} textStyle={styles.teacherChipText}>
                        {teacher.name || teacher.email}
                      </Chip>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.subjectActions}>
                <Chip style={[styles.subjectChip, { backgroundColor: subject.color }]}>
                  {subject.teachers?.length || 0} Teachers
                </Chip>
                <Button
                  mode="outlined"
                  icon="account-plus"
                  onPress={() => setTeacherDialog({ visible: true, subject })}
                  style={styles.assignButton}
                >
                  Assign
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={activeTab}
        onValueChange={setActiveTab}
        buttons={[
          { value: 'overview', label: 'Overview' },
          { value: 'users', label: 'Users' },
          { value: 'subjects', label: 'Subjects' },
        ]}
        style={styles.tabs}
      />

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'subjects' && renderSubjects()}

      {/* Create User Dialog */}
      <Portal>
        <Dialog visible={createUserDialog.visible} onDismiss={() => setCreateUserDialog({ visible: false })}>
          <Dialog.Title>Add New User</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={newUser.name}
              onChangeText={(text) => setNewUser({ ...newUser, name: text })}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Email"
              value={newUser.email}
              onChangeText={(text) => setNewUser({ ...newUser, email: text })}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              label="Password"
              value={newUser.password}
              onChangeText={(text) => setNewUser({ ...newUser, password: text })}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />
            
            <Text style={styles.roleLabel}>Role:</Text>
            <View style={styles.roleButtons}>
              <Button 
                mode={newUser.role === 'student' ? 'contained' : 'outlined'}
                onPress={() => setNewUser({ ...newUser, role: 'student' })}
                style={styles.roleButton}
              >
                Student
              </Button>
              <Button 
                mode={newUser.role === 'teacher' ? 'contained' : 'outlined'}
                onPress={() => setNewUser({ ...newUser, role: 'teacher' })}
                style={styles.roleButton}
              >
                Teacher
              </Button>
              <Button 
                mode={newUser.role === 'admin' ? 'contained' : 'outlined'}
                onPress={() => setNewUser({ ...newUser, role: 'admin' })}
                style={styles.roleButton}
              >
                Admin
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateUserDialog({ visible: false })}>Cancel</Button>
            <Button onPress={createUser}>Create</Button>
          </Dialog.Actions>
        </Dialog>

        {/* User Role Edit Dialog */}
        <Dialog visible={userDialog.visible} onDismiss={() => setUserDialog({ visible: false, user: null })}>
          <Dialog.Title>Edit User Role</Dialog.Title>
          <Dialog.Content>
            <Text>User: {userDialog.user?.name}</Text>
            <Text>Current Role: {userDialog.user?.role}</Text>
            
            <View style={styles.roleButtons}>
              <Button 
                mode={userDialog.user?.role === 'student' ? 'contained' : 'outlined'}
                onPress={() => updateUserRole(userDialog.user?._id, 'student')}
                style={styles.roleButton}
              >
                Student
              </Button>
              <Button 
                mode={userDialog.user?.role === 'teacher' ? 'contained' : 'outlined'}
                onPress={() => updateUserRole(userDialog.user?._id, 'teacher')}
                style={styles.roleButton}
              >
                Teacher
              </Button>
              <Button 
                mode={userDialog.user?.role === 'admin' ? 'contained' : 'outlined'}
                onPress={() => updateUserRole(userDialog.user?._id, 'admin')}
                style={styles.roleButton}
              >
                Admin
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUserDialog({ visible: false, user: null })}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Create Subject Dialog */}
        <Dialog visible={subjectDialog.visible && !subjectDialog.subject} onDismiss={() => setSubjectDialog({ visible: false, subject: null })}>
          <Dialog.Title>Add New Subject</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Subject Name"
              value={newSubject.name}
              onChangeText={(text) => setNewSubject({ ...newSubject, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="e.g. Mathematics"
            />
            <TextInput
              label="Subject Code"
              value={newSubject.code}
              onChangeText={(text) => setNewSubject({ ...newSubject, code: text })}
              mode="outlined"
              style={styles.input}
              placeholder="e.g. MATH101"
            />
            <TextInput
              label="Description (Optional)"
              value={newSubject.description}
              onChangeText={(text) => setNewSubject({ ...newSubject, description: text })}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              placeholder="Brief description of the subject"
            />
            
            <Text style={styles.roleLabel}>Subject Color:</Text>
            <View style={styles.colorPicker}>
              {['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'].map(color => (
                <Button
                  key={color}
                  mode={newSubject.color === color ? 'contained' : 'outlined'}
                  onPress={() => setNewSubject({ ...newSubject, color })}
                  style={[styles.colorButton, { backgroundColor: color }]}
                >
                  {' '}
                </Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSubjectDialog({ visible: false, subject: null })}>Cancel</Button>
            <Button onPress={createSubject}>Create</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Assign Teachers Dialog */}
        <Dialog visible={teacherDialog.visible} onDismiss={() => setTeacherDialog({ visible: false, subject: null })}>
          <Dialog.Title>Assign Teachers to {teacherDialog.subject?.name}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 400 }}>
            <ScrollView>
              {teachers.length > 0 ? (
                teachers.map(teacher => {
                  const isAssigned = teacherDialog.subject?.teachers?.some(t => t._id === teacher._id);
                  return (
                    <View key={teacher._id} style={styles.teacherItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teacherName}>{teacher.name}</Text>
                        <Text style={styles.teacherEmail}>{teacher.email}</Text>
                      </View>
                      <Button
                        mode={isAssigned ? 'contained' : 'outlined'}
                        onPress={() => {
                          const currentTeachers = teacherDialog.subject?.teachers?.map(t => t._id) || [];
                          const newTeachers = isAssigned
                            ? currentTeachers.filter(id => id !== teacher._id)
                            : [...currentTeachers, teacher._id];
                          assignTeachersToSubject(teacherDialog.subject._id, newTeachers);
                        }}
                        compact
                      >
                        {isAssigned ? 'Assigned' : 'Assign'}
                      </Button>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noTeachersText}>No teachers available. Create teacher accounts first.</Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setTeacherDialog({ visible: false, subject: null })}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabs: {
    margin: 16,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    minWidth: '40%',
    marginVertical: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 16,
  },
  roleChip: {
    minWidth: 80,
  },
  adminChip: {
    backgroundColor: '#f44336',
  },
  teacherChip: {
    backgroundColor: '#ff9800',
  },
  studentChip: {
    backgroundColor: '#4caf50',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subjectCode: {
    fontSize: 14,
    color: '#666',
  },
  subjectChip: {
    color: 'white',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  roleButton: {
    minWidth: 80,
  },
  addButton: {
    margin: 16,
    marginBottom: 8,
  },
  input: {
    marginBottom: 12,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 8,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  colorButton: {
    minWidth: 50,
    height: 50,
    borderRadius: 25,
  },
  subjectDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  subjectActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  assignButton: {
    marginTop: 4,
  },
  teachersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  teachersLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 4,
  },
  teacherChip: {
    backgroundColor: '#e3f2fd',
    height: 24,
  },
  teacherChipText: {
    fontSize: 11,
    color: '#1976d2',
  },
  teacherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  teacherEmail: {
    fontSize: 12,
    color: '#666',
  },
  noTeachersText: {
    padding: 20,
    textAlign: 'center',
    color: '#666',
  },
});
