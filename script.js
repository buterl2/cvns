// This is a simplified approach focused on reliable synchronization
// Replace your script.js with this version

document.addEventListener('DOMContentLoaded', function() {
    // Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
    const firebaseConfig = {
        apiKey: "AIzaSyBZhaLwkyDjtIOCkAbFIDORAVpNP5SK0OY",
        authDomain: "planning-board-1ad74.firebaseapp.com",
        databaseURL: "https://planning-board-1ad74-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "planning-board-1ad74",
        storageBucket: "planning-board-1ad74.firebasestorage.app",
        messagingSenderId: "867603634354",
        appId: "1:867603634354:web:914c4a61c070cb828a51ab",
        measurementId: "G-EJ0085542E"
    };
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    
    // ======= DIRECT REFERENCES TO FIREBASE PATHS =======
    // This is key to the new approach - we reference specific parts of the database
    const staffListRef = db.ref('planningBoard/staff');
    const positionsRef = db.ref('planningBoard/positions');
    
    // Elements
    const availableStaffContainer = document.getElementById('available-staff');
    const staffPool = document.querySelector('.staff-pool');
    const addStaffButton = document.getElementById('add-staff');
    const removeStaffButton = document.getElementById('remove-staff');
    const saveButton = document.getElementById('save-board');
    const resetButton = document.getElementById('reset-board');
    const modal = document.getElementById('add-staff-modal');
    const closeButton = document.querySelector('.close-button');
    const newStaffForm = document.getElementById('new-staff-form');
    const allDropZones = document.querySelectorAll('.staff-dropzone');
    const floorToggles = document.querySelectorAll('.floor-toggle');
    
    // Connection status elements
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    // Add Support button
    const addSupportButton = document.createElement('button');
    addSupportButton.id = 'add-support';
    addSupportButton.textContent = 'Add Support';
    document.querySelector('.controls').appendChild(addSupportButton);
    
    // Track removal mode
    let removalMode = false;
    
    // Local tracking of staff and positions
    let staffList = [];
    let positions = {};
    
    // Initialize
    init();
    
    function init() {
        console.log('Initializing planning board...');
        
        // Show connecting status
        updateConnectionStatus('connecting', 'Connecting...');
        
        // Set up connection monitoring
        setupConnectionMonitoring();
        
        // Clear all containers to start fresh
        availableStaffContainer.innerHTML = '';
        document.querySelectorAll('.staff-dropzone').forEach(zone => {
            zone.innerHTML = '';
        });
        
        // Set up event listeners for UI interactions
        setupEventListeners();
        
        // Set up drag and drop
        setupDragAndDrop();
        
        // Load initial data and set up realtime listeners
        loadInitialData();
    }
    
    function setupConnectionMonitoring() {
        const connectedRef = firebase.database().ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                console.log('Connected to Firebase');
                updateConnectionStatus('online', 'Online');
            } else {
                console.log('Disconnected from Firebase');
                updateConnectionStatus('offline', 'Offline');
            }
        });
    }
    
    function updateConnectionStatus(status, message) {
        if (!statusIndicator || !statusText) {
            console.warn('Status indicator elements not found');
            return;
        }
        
        // Remove all status classes
        statusIndicator.classList.remove('online', 'offline', 'connecting', 'syncing', 'error');
        
        // Add the appropriate class
        statusIndicator.classList.add(status);
        statusText.textContent = message;
    }
    
    function loadInitialData() {
        // Load staff list
        staffListRef.once('value')
            .then(snapshot => {
                if (snapshot.exists()) {
                    console.log('Found existing staff data');
                    staffList = snapshot.val() || [];
                } else {
                    console.log('No existing staff data, using sample data');
                    // Sample staff data
                    staffList = [
                        { id: 'sample1', name: 'John Doe', photo: 'placeholder-photo.jpg' },
                        { id: 'sample2', name: 'Jane Smith', photo: 'placeholder-photo.jpg' },
                        { id: 'sample3', name: 'Mike Johnson', photo: 'placeholder-photo.jpg' },
                        { id: 'sample4', name: 'Sarah Williams', photo: 'placeholder-photo.jpg' },
                        { id: 'sample5', name: 'David Brown', photo: 'placeholder-photo.jpg' }
                    ];
                    // Save sample data
                    staffListRef.set(staffList);
                }
                
                // Load positions data
                return positionsRef.once('value');
            })
            .then(snapshot => {
                if (snapshot.exists()) {
                    console.log('Found existing positions data');
                    positions = snapshot.val() || {};
                } else {
                    console.log('No existing positions data');
                    positions = {};
                    // Save empty positions
                    positionsRef.set(positions);
                }
                
                // Now that we have both staff and positions, render the board
                renderBoard();
                
                // Set up realtime listeners for ongoing changes
                setupRealtimeListeners();
                
                console.log('Initialization complete');
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                updateConnectionStatus('error', 'Data Load Error');
            });
    }
    
    function setupRealtimeListeners() {
        // Listen for staff changes
        staffListRef.on('value', snapshot => {
            console.log('Staff list updated in Firebase');
            staffList = snapshot.val() || [];
            renderStaffList();
        });
        
        // Listen for position changes
        positionsRef.on('value', snapshot => {
            console.log('Positions updated in Firebase');
            positions = snapshot.val() || {};
            renderPositions();
        });
    }
    
    function renderBoard() {
        // Clear everything first
        availableStaffContainer.innerHTML = '';
        document.querySelectorAll('.staff-dropzone').forEach(zone => {
            zone.innerHTML = '';
        });
        
        // Render staff and positions
        renderStaffList();
        renderPositions();
    }
    
    function renderStaffList() {
        // First collect all staff IDs that are in positions
        const placedStaffIds = [];
        for (const positionId in positions) {
            if (positions[positionId] && Array.isArray(positions[positionId])) {
                positions[positionId].forEach(staffId => {
                    placedStaffIds.push(staffId);
                });
            }
        }
        
        // Clear the available staff container
        availableStaffContainer.innerHTML = '';
        
        // Add staff that are not in positions to the available pool
        staffList.forEach(staff => {
            if (!placedStaffIds.includes(staff.id)) {
                createStaffCard(staff.id, staff.name, staff.photo);
            }
        });
    }
    
    function renderPositions() {
        // For each position, clear it and then add the assigned staff
        allDropZones.forEach(zone => {
            const positionSlot = zone.closest('.position-slot');
            if (!positionSlot) return;
            
            const positionId = positionSlot.getAttribute('data-position');
            
            // Clear the zone
            zone.innerHTML = '';
            
            // If there are staff assigned to this position
            if (positions[positionId] && Array.isArray(positions[positionId])) {
                positions[positionId].forEach(staffId => {
                    // Find the staff data
                    const staffData = staffList.find(s => s.id === staffId);
                    if (staffData) {
                        // Create the staff card
                        const staffCard = document.createElement('div');
                        staffCard.className = 'staff-card';
                        staffCard.setAttribute('draggable', 'true');
                        staffCard.setAttribute('data-id', staffId);
                        
                        staffCard.innerHTML = `
                            <div class="staff-photo">
                                <img src="${staffData.photo}" alt="${staffData.name}">
                            </div>
                            <div class="staff-info">
                                <p class="staff-name">${staffData.name}</p>
                            </div>
                        `;
                        
                        // Add to the zone
                        zone.appendChild(staffCard);
                        
                        // Setup drag events
                        setupDragEventsForElement(staffCard);
                    }
                });
            }
            
            // Equalize heights in rows
            equalizeHeightsInRow(zone);
        });
        
        // Re-setup drag and drop
        setupDragAndDrop();
    }
    
    function setupEventListeners() {
        // Add staff button
        addStaffButton.addEventListener('click', () => {
            modal.style.display = 'block';
        });
        
        // Add support button
        addSupportButton.addEventListener('click', () => {
            const supportName = prompt('Enter support name:');
            if (supportName && supportName.trim() !== '') {
                addNewStaff('support-' + Date.now(), supportName.trim(), createPlaceholderImage());
            }
        });
        
        // Remove staff button
        removeStaffButton.addEventListener('click', toggleRemovalMode);
        
        // Close modal
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Add new staff form
        newStaffForm.addEventListener('submit', handleNewStaffSubmit);
        
        // Save board button (for manual save)
        saveButton.addEventListener('click', () => {
            saveBoardState();
        });
        
        // Reset board
        resetButton.addEventListener('click', confirmReset);
        
        // Floor toggle buttons
        floorToggles.forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                const floor = this.closest('.floor');
                floor.classList.toggle('collapsed');
                this.textContent = floor.classList.contains('collapsed') ? '+' : '−';
                e.stopPropagation();
            });
        });
    }
    
    function toggleRemovalMode() {
        removalMode = !removalMode;
        
        if (removalMode) {
            removeStaffButton.classList.add('active');
            removeStaffButton.textContent = 'Cancel Removal';
            document.body.classList.add('removal-mode');
            
            // Add click events for removal
            document.querySelectorAll('.staff-card').forEach(card => {
                card.classList.add('removable');
                card.addEventListener('click', removeStaffCard);
            });
        } else {
            removeStaffButton.classList.remove('active');
            removeStaffButton.textContent = 'Remove Staff';
            document.body.classList.remove('removal-mode');
            
            // Remove click events
            document.querySelectorAll('.staff-card').forEach(card => {
                card.classList.remove('removable');
                card.removeEventListener('click', removeStaffCard);
            });
        }
    }
    
    function removeStaffCard(e) {
        if (removalMode) {
            const card = e.currentTarget;
            const staffId = card.getAttribute('data-id');
            
            // Remove the staff from our staff list
            const staffIndex = staffList.findIndex(s => s.id === staffId);
            if (staffIndex !== -1) {
                staffList.splice(staffIndex, 1);
                staffListRef.set(staffList);
                
                // Also remove from any positions
                for (const positionId in positions) {
                    if (positions[positionId] && Array.isArray(positions[positionId])) {
                        const staffIndex = positions[positionId].indexOf(staffId);
                        if (staffIndex !== -1) {
                            positions[positionId].splice(staffIndex, 1);
                            if (positions[positionId].length === 0) {
                                // If position is empty, set to empty array explicitly
                                positions[positionId] = [];
                            }
                        }
                    }
                }
                positionsRef.set(positions);
            }
            
            card.remove();
        }
    }
    
    function handleNewStaffSubmit(e) {
        e.preventDefault();
        
        const nameInput = document.getElementById('staff-name');
        const photoInput = document.getElementById('staff-photo');
        
        const name = nameInput.value.trim();
        let photoSrc = 'placeholder-photo.jpg'; // Default photo
        
        // Handle photo upload
        if (photoInput.files && photoInput.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                photoSrc = e.target.result;
                addNewStaff('staff-' + Date.now(), name, photoSrc);
                
                // Reset form and close modal
                nameInput.value = '';
                photoInput.value = '';
                modal.style.display = 'none';
            };
            
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            photoSrc = createPlaceholderImage();
            addNewStaff('staff-' + Date.now(), name, photoSrc);
            
            // Reset form and close modal
            nameInput.value = '';
            photoInput.value = '';
            modal.style.display = 'none';
        }
    }
    
    function addNewStaff(id, name, photoSrc) {
        // Add to our staff list
        staffList.push({
            id: id,
            name: name,
            photo: photoSrc
        });
        
        // Update Firebase
        updateConnectionStatus('syncing', 'Saving...');
        staffListRef.set(staffList)
            .then(() => {
                console.log('Staff added successfully');
                updateConnectionStatus('online', 'Saved');
            })
            .catch(error => {
                console.error('Error adding staff:', error);
                updateConnectionStatus('error', 'Save Error');
            });
    }
    
    // Create a placeholder image with MDT text
    function createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        
        const ctx = canvas.getContext('2d');
        
        // Draw blue circle
        ctx.fillStyle = '#0057B8'; // Medtronic blue
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2);
        ctx.fill();
        
        // Add MDT text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MDT', 50, 50);
        
        return canvas.toDataURL('image/png');
    }
    
    function createStaffCard(id, name, photoSrc) {
        // If photoSrc is the default placeholder, replace with our custom one
        if (photoSrc === 'placeholder-photo.jpg') {
            photoSrc = createPlaceholderImage();
        }
        
        const staffCard = document.createElement('div');
        staffCard.className = 'staff-card';
        staffCard.setAttribute('draggable', 'true');
        staffCard.setAttribute('data-id', id);
        
        staffCard.innerHTML = `
            <div class="staff-photo">
                <img src="${photoSrc}" alt="${name}">
            </div>
            <div class="staff-info">
                <p class="staff-name">${name}</p>
            </div>
        `;
        
        // Add to staff pool
        availableStaffContainer.appendChild(staffCard);
        
        // Set up drag events for the new card
        setupDragEventsForElement(staffCard);
        
        // Register for removal if in removal mode
        if (removalMode) {
            registerForRemoval(staffCard);
        }
    }
    
    // Register a staff card for removal mode if it's active
    function registerForRemoval(card) {
        card.classList.add('removable');
        card.addEventListener('click', removeStaffCard);
    }
    
    function setupDragEventsForElement(element) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', element.getAttribute('data-id'));
            element.classList.add('dragging');
            
            // If this card is in a dropzone, temporarily add a placeholder
            const parentDropzone = element.closest('.staff-dropzone');
            if (parentDropzone) {
                // Create placeholder to maintain dropzone height
                const placeholder = document.createElement('div');
                placeholder.className = 'staff-placeholder';
                placeholder.style.height = `${element.offsetHeight}px`;
                parentDropzone.appendChild(placeholder);
            }
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            
            // Remove any placeholders
            document.querySelectorAll('.staff-placeholder').forEach(ph => ph.remove());
        });
    }
    
    function setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('highlight');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('highlight');
        });
        
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('highlight');
            
            const staffId = e.dataTransfer.getData('text/plain');
            const staffCard = document.querySelector(`[data-id="${staffId}"]`);
            
            if (staffCard) {
                // Get the position ID
                const positionSlot = zone.closest('.position-slot');
                if (!positionSlot) return;
                
                const positionId = positionSlot.getAttribute('data-position');
                
                // First, remove staff from any position they might be in
                for (const pos in positions) {
                    if (positions[pos] && Array.isArray(positions[pos])) {
                        const index = positions[pos].indexOf(staffId);
                        if (index !== -1) {
                            positions[pos].splice(index, 1);
                            if (positions[pos].length === 0) {
                                positions[pos] = [];
                            }
                        }
                    }
                }
                
                // Then, add to the new position
                if (!positions[positionId]) {
                    positions[positionId] = [];
                }
                positions[positionId].push(staffId);
                
                // Save the updated positions
                updateConnectionStatus('syncing', 'Saving...');
                positionsRef.set(positions)
                    .then(() => {
                        console.log('Positions updated successfully');
                        updateConnectionStatus('online', 'Saved');
                    })
                    .catch(error => {
                        console.error('Error updating positions:', error);
                        updateConnectionStatus('error', 'Save Error');
                    });
                
                // Animation effect
                staffCard.classList.add('dropped');
                setTimeout(() => {
                    staffCard.classList.remove('dropped');
                }, 300);
            }
        });
    }
    
    // Make staff pool a valid dropzone for returning operators
    function setupStaffPoolAsDropZone() {
        // Make both the container and section droppable
        [staffPool, availableStaffContainer].forEach(element => {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                staffPool.classList.add('highlight');
            });
            
            element.addEventListener('dragleave', () => {
                staffPool.classList.remove('highlight');
            });
            
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                staffPool.classList.remove('highlight');
                
                const staffId = e.dataTransfer.getData('text/plain');
                
                // Remove staff from any position
                for (const positionId in positions) {
                    if (positions[positionId] && Array.isArray(positions[positionId])) {
                        const staffIndex = positions[positionId].indexOf(staffId);
                        if (staffIndex !== -1) {
                            positions[positionId].splice(staffIndex, 1);
                            if (positions[positionId].length === 0) {
                                positions[positionId] = [];
                            }
                            
                            // Save the updated positions
                            updateConnectionStatus('syncing', 'Saving...');
                            positionsRef.set(positions)
                                .then(() => {
                                    console.log('Staff returned to pool successfully');
                                    updateConnectionStatus('online', 'Saved');
                                })
                                .catch(error => {
                                    console.error('Error returning staff to pool:', error);
                                    updateConnectionStatus('error', 'Save Error');
                                });
                        }
                    }
                }
            });
        });
    }
    
    // Only equalize heights of positions in the same visual row
    function equalizeHeightsInRow(zone) {
        // Find the position slot this zone belongs to
        const positionSlot = zone.closest('.position-slot');
        if (!positionSlot) return;
        
        const container = positionSlot.parentElement;
        const allPositionSlots = Array.from(container.querySelectorAll('.position-slot'));
        
        // Get the vertical position of this slot
        const rect = positionSlot.getBoundingClientRect();
        const thisTop = rect.top;
        
        // Find all slots in the same visual row (with the same or very close top position)
        const tolerance = 10; // 10px tolerance for slight misalignments
        const sameRowSlots = allPositionSlots.filter(slot => {
            const slotRect = slot.getBoundingClientRect();
            return Math.abs(slotRect.top - thisTop) <= tolerance;
        });
        
        // Get dropzones in these slots
        const dropzonesInRow = sameRowSlots.map(slot => slot.querySelector('.staff-dropzone'));
        
        // Reset heights first
        dropzonesInRow.forEach(dz => {
            if (dz) dz.style.height = 'auto';
        });
        
        // Wait for the DOM to update
        setTimeout(() => {
            // Find the tallest dropzone
            const heights = dropzonesInRow.map(dz => dz ? dz.offsetHeight : 0);
            const maxHeight = Math.max(...heights);
            
            // Set all dropzones to the tallest height
            dropzonesInRow.forEach(dz => {
                if (dz) dz.style.height = maxHeight + 'px';
            });
        }, 10);
    }
    
    function saveBoardState() {
        // This is a manual save function, useful as a fallback
        // Update Firebase
        updateConnectionStatus('syncing', 'Saving...');
        
        // Create a transaction to update both staff and positions together
        const updates = {};
        updates['planningBoard/staff'] = staffList;
        updates['planningBoard/positions'] = positions;
        
        firebase.database().ref().update(updates)
            .then(() => {
                console.log('Board saved successfully to Firebase');
                updateConnectionStatus('online', 'Saved');
            })
            .catch(error => {
                console.error('Error saving to Firebase:', error);
                updateConnectionStatus('error', 'Save Error');
            });
    }
    
    function confirmReset() {
        if (confirm('Are you sure you want to reset the planning board? All assignments will be cleared.')) {
            resetBoard();
        }
    }
    
    function resetBoard() {
        // Reset all positions to empty arrays
        for (const positionId in positions) {
            positions[positionId] = [];
        }
        
        // Save to Firebase
        updateConnectionStatus('syncing', 'Resetting...');
        positionsRef.set(positions)
            .then(() => {
                console.log('Board reset successfully');
                updateConnectionStatus('online', 'Reset Complete');
            })
            .catch(error => {
                console.error('Error resetting board:', error);
                updateConnectionStatus('error', 'Reset Error');
            });
    }
    
    function setupDragAndDrop() {
        // Set up drag events for all existing staff cards
        document.querySelectorAll('.staff-card').forEach(card => {
            setupDragEventsForElement(card);
        });
        
        // Set up drop events for all dropzones
        allDropZones.forEach(zone => {
            setupDropZone(zone);
        });
        
        // Make staff pool a valid dropzone
        setupStaffPoolAsDropZone();
        
        // Initialize heights for all rows
        document.querySelectorAll('.positions-container').forEach(container => {
            const firstDropzone = container.querySelector('.staff-dropzone');
            if (firstDropzone) {
                equalizeHeightsInRow(firstDropzone);
            }
        });
    }
});