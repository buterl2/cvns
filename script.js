// Global variables
let staffMembers = [];
let isLocked = false;
const PLANNING_PASSWORD = 'CVNS2025';
let currentUser;
const userColors = [
  '#4CAF50', '#2196F3', '#FF9800', '#E91E63', 
  '#9C27B0', '#00BCD4', '#FFEB3B', '#795548'
];

// Productivity rates for different zones
const productivityRates = {
    'long-picking': 65,
    'long-packing': 32,
    'long-palletizing': 120,
    'long-vas': 20,
    'long-aortic': 20,
    'long-ipoint': 85,
    'small-picking': 70,
    'small-packing': 45,
    'small-vas': 30,
    'small-heart-valves': 30,
    'surgical-picking': 70,
    'surgical-packing': 45,
    'surgical-vas': 30,
    'small-ipoint': 85,
    'surgical-ipoint': 85
};

// Initialize the page with Firebase connection
function init() {
    enhancedInit();
}

// Enhanced initialization with Firebase
function enhancedInit() {
    generateUserId();
    setupFirebaseListeners();
    setupOutputListeners();
    setupUserActivityListeners();
    setupSectionStateListeners();
    updateClock();
    setInterval(updateClock, 1000);
    setupModals();
    
    // Add listeners for change notifications
    window.db.ref('staffMembers').on('child_added', () => {
        showChangeNotification('New staff member added');
    });
    
    window.db.ref('staffMembers').on('child_removed', () => {
        showChangeNotification('Staff member removed');
    });
    
    window.db.ref('assignments').on('child_changed', () => {
        showChangeNotification('Assignments updated');
    });
}

// Generate a random user ID for cursor tracking
function generateUserId() {
    // Create a random ID for this user
    currentUser = {
        id: 'user_' + Math.random().toString(36).substr(2, 9),
        color: userColors[Math.floor(Math.random() * userColors.length)]
    };
    
    // Store the user in Firebase so others know they're online
    window.db.ref('users/' + currentUser.id).set({
        lastActive: firebase.database.ServerValue.TIMESTAMP,
        color: currentUser.color
    });
    
    // Remove the user when they leave
    window.addEventListener('beforeunload', () => {
        window.db.ref('users/' + currentUser.id).remove();
    });
    
    // Keep user's "lastActive" updated
    setInterval(() => {
        window.db.ref('users/' + currentUser.id + '/lastActive').set(firebase.database.ServerValue.TIMESTAMP);
    }, 30000);
}

// Setup Firebase listeners
function setupFirebaseListeners() {
    // Listen for staff members changes
    window.db.ref('staffMembers').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            staffMembers = Object.values(data);
            renderStaffList();
            setupDragAndDrop();
        }
    });
    
    // Listen for staff assignments
    window.db.ref('assignments').on('value', (snapshot) => {
        const assignments = snapshot.val() || {};
        
        // Clear all zones
        document.querySelectorAll('.drag-zone .staff-card').forEach(card => {
            card.remove();
        });
        
        // Define management zones with multiple slots
        const managementZones = ['management-operations', 'management-supervision', 'management-coordinator'];
        
        // Repopulate zones based on Firebase data
        Object.entries(assignments).forEach(([zoneId, data]) => {
            // For management zones with slots
            if (managementZones.includes(zoneId)) {
                // Handle slot-specific assignments
                if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                    // data is an object with slot keys
                    Object.entries(data).forEach(([slotIndex, staffId]) => {
                        if (staffId) {
                            const staff = staffMembers.find(s => s.id === parseInt(staffId));
                            if (staff) {
                                staff.assigned = true;
                                
                                // Find all zones with this zone ID
                                const allZonesOfType = document.querySelectorAll(`[data-zone="${zoneId}"]`);
                                // Get the specific slot by index
                                if (allZonesOfType[parseInt(slotIndex)]) {
                                    appendStaffToZone(staff, allZonesOfType[parseInt(slotIndex)]);
                                }
                            }
                        }
                    });
                }
            } else {
                // For regular zones (non-management), handle as before
                if (Array.isArray(data)) {
                    data.forEach(staffId => {
                        const staff = staffMembers.find(s => s.id === parseInt(staffId));
                        if (staff) {
                            staff.assigned = true;
                            const zone = document.querySelector(`[data-zone="${zoneId}"]`);
                            if (zone) {
                                appendStaffToZone(staff, zone);
                            }
                        }
                    });
                }
            }
        });
        
        // Update productivity for all zones
        document.querySelectorAll('.drag-zone').forEach(zone => {
            updateProductivity(zone);
        });
    });
    
    // Listen for lock status
    window.db.ref('isLocked').on('value', (snapshot) => {
        isLocked = snapshot.val() || false;
        document.getElementById('lockStatus').textContent = isLocked ? 'Unlock Planning' : 'Lock Planning';
    });
    
    // Listen for cursor positions (optional - for collaborative feel)
    window.db.ref('cursors').on('value', (snapshot) => {
        const cursors = snapshot.val() || {};
        updateCursors(cursors);
    });

    // Listen for button states
    window.db.ref('buttonStates').on('value', (snapshot) => {
        const states = snapshot.val() || {};
        Object.entries(states).forEach(([id, state]) => {
            const button = document.getElementById(id);
            if (button) {
                button.textContent = state;
            }
        });
    });
}

// Additional Firebase listeners
function setupOutputListeners() {
    window.db.ref('outputs').on('value', (snapshot) => {
        const outputs = snapshot.val() || {};
        Object.entries(outputs).forEach(([zoneId, output]) => {
            const outputElement = document.getElementById(`${zoneId}-output`);
            if (outputElement) {
                outputElement.textContent = output;
            }
        });
    });
}

function setupUserActivityListeners() {
    window.db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const count = Object.keys(users).length;
        document.getElementById('activeUsers').textContent = `${count} user${count !== 1 ? 's' : ''} online`;
    });
}

function setupSectionStateListeners() {
    window.db.ref('sectionStates').on('value', (snapshot) => {
        const states = snapshot.val() || {};
        Object.entries(states).forEach(([sectionId, isExpanded]) => {
            const section = document.getElementById(sectionId);
            if (section) {
                if (isExpanded) {
                    section.classList.add('expanded');
                } else {
                    section.classList.remove('expanded');
                }
            }
        });
    });
}

// Function to show other users' cursors
function updateCursors(cursors) {
    // Remove old cursor elements
    document.querySelectorAll('.user-cursor').forEach(el => el.remove());
    
    // Add cursor elements for other users
    Object.entries(cursors).forEach(([userId, cursorData]) => {
        if (userId !== currentUser.id && cursorData.timestamp > Date.now() - 10000) {
            const cursorEl = document.createElement('div');
            cursorEl.className = 'user-cursor';
            cursorEl.style.left = cursorData.x + 'px';
            cursorEl.style.top = cursorData.y + 'px';
            cursorEl.style.backgroundColor = cursorData.color;
            document.body.appendChild(cursorEl);
        }
    });
}

// Track and broadcast cursor position
document.addEventListener('mousemove', debounce((e) => {
    window.db.ref('cursors/' + currentUser.id).set({
        x: e.clientX,
        y: e.clientY,
        color: currentUser.color,
        timestamp: Date.now()
    });
}, 100));

// Utility function for limiting cursor updates
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Show notification when changes happen
function showChangeNotification(message) {
    const notification = document.getElementById('changeNotification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Setup modals and form handlers
function setupModals() {
    document.getElementById('addSupportForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (isLocked) {
            alert('Planning is locked. Unlock it first.');
            return;
        }
        
        const name = document.getElementById('supportName').value;
        const role = document.getElementById('supportRole').value;
        const newStaffId = Date.now(); // Use timestamp as unique ID
        const newStaff = {
            id: newStaffId,
            name: name,
            role: role,
            photo: null,
            assigned: false
        };
        
        // Add to Firebase
        window.db.ref('staffMembers/' + newStaffId).set(newStaff);
        
        hideAddSupportModal();
        this.reset();
    });

    document.getElementById('addStaffForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (isLocked) {
            alert('Planning is locked. Unlock it first.');
            return;
        }
        
        const name = document.getElementById('staffName').value;
        const role = document.getElementById('staffRole').value;
        const shift = document.getElementById('staffShift').value;
        const photoInput = document.getElementById('staffPhoto');
        const photoPreview = document.getElementById('photoPreview');
        
        let photo = null;
        if (photoPreview.style.backgroundImage) {
            photo = photoPreview.style.backgroundImage.slice(5, -2);
        }
        
        const newStaffId = Date.now(); // Use timestamp as unique ID
        const newStaff = {
            id: newStaffId,
            name: name,
            role: role,
            photo: photo,
            assigned: false,
            shift: shift
        };
        
        // Add to Firebase
        window.db.ref('staffMembers/' + newStaffId).set(newStaff);
        
        hideAddStaffModal();
        this.reset();
        photoPreview.style.backgroundImage = '';
        photoPreview.classList.add('hidden');
    });

    // Photo upload preview
    document.getElementById('staffPhoto').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoPreview = document.getElementById('photoPreview');
                photoPreview.style.backgroundImage = `url(${e.target.result})`;
                photoPreview.style.backgroundPosition = 'center';
                photoPreview.style.backgroundSize = '120%';
                photoPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });
}

// Clock update function
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('clock').textContent = timeStr;
}

// Toggle lock planning function
function toggleLockPlanning() {
    if (isLocked) {
        const password = prompt('Enter password to unlock planning:');
        if (password === PLANNING_PASSWORD) {
            window.db.ref('isLocked').set(false);
        } else {
            alert('Incorrect password');
        }
    } else {
        window.db.ref('isLocked').set(true);
    }
}

// Reset board function
function resetBoard() {
    if (isLocked) {
        alert('Planning is locked. Unlock it first.');
        return;
    }
    const confirmation = confirm('Are you sure you want to reset the board?');
    if (confirmation) {
        // Clear all assignments in Firebase
        window.db.ref('assignments').set({});
        
        // Update staff members to unassigned
        const updatedStaff = {};
        staffMembers.forEach(staff => {
            staff.assigned = false;
            updatedStaff[staff.id] = staff;
        });
        window.db.ref('staffMembers').set(updatedStaff);
    }
}

// Render staff list
function renderStaffList() {
    const staffList = document.getElementById('staffList');
    staffList.innerHTML = staffMembers
        .filter(staff => !staff.assigned)
        .map(staff => `
            <div class="staff-card ${staff.shift === 'I' ? 'bg-[#242b4e]' : 'bg-[#2f3a6c]'} p-3 rounded-lg flex items-center justify-between"
                draggable="true" data-staff-id="${staff.id}">
                <div class="flex items-center gap-3" onclick="showStaffCard(${staff.id})">
                    ${staff.photo
                        ? `<img src="${staff.photo}" class="w-11 h-11 rounded-full object-cover cursor-pointer">`
                        : `<div class="w-11 h-11 bg-secondary rounded-full flex items-center justify-center cursor-pointer">
                            ${staff.name.charAt(0)}
                          </div>`
                    }
                    <div>
                        <div class="font-medium">${staff.name}</div>
                        <div class="text-sm text-gray-400">Group ${staff.role}</div>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); deleteStaff(${staff.id})" class="text-gray-400 hover:text-red-500">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `).join('');
}

// Setup drag and drop
function setupDragAndDrop() {
    const staffCards = document.querySelectorAll('.staff-card');
    const dropZones = document.querySelectorAll('.drag-zone');
    const staffList = document.getElementById('staffList');
    
    // Make staff list a drop zone
    staffList.addEventListener('dragover', handleDragOver);
    staffList.addEventListener('dragleave', handleDragLeave);
    staffList.addEventListener('drop', handleDrop);
    
    staffCards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });
}

// Drag and drop handlers
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.staffId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    const zone = e.target.closest('.drag-zone');
    if (zone) {
        zone.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const zone = e.target.closest('.drag-zone');
    if (zone) {
        zone.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    if (isLocked) {
        alert('Planning is locked. Unlock it first.');
        return;
    }
    
    const zone = e.target.closest('.drag-zone');
    if (!zone) return; // Exit if not dropped on a valid zone
    
    zone.classList.remove('drag-over');
    const staffId = parseInt(e.dataTransfer.getData('text/plain'));
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return;
    
    // Get the zone ID
    const zoneId = zone.dataset.zone;
    
    // For management zones, determine the specific slot index
    const managementZones = ['management-operations', 'management-supervision', 'management-coordinator'];
    
    if (managementZones.includes(zoneId)) {
        // Find all elements with this zone ID
        const allZonesOfType = Array.from(document.querySelectorAll(`[data-zone="${zoneId}"]`));
        const slotIndex = allZonesOfType.indexOf(zone);
        
        if (slotIndex !== -1) {
            // Update Firebase with the slot-specific assignment
            updateSlotAssignment(staffId, zoneId, slotIndex);
        }
    } else {
        // For regular zones, update as before
        updateAssignment(staffId, zoneId);
    }
}

// Function to update slot-specific assignments
function updateSlotAssignment(staffId, zoneId, slotIndex) {
    // First, remove this staff from any existing assignment
    window.db.ref('assignments').once('value', (snapshot) => {
        const assignments = snapshot.val() || {};
        
        // Create updates object
        let updates = {};
        
        // Handle removal from management zones (slot-based)
        const managementZones = ['management-operations', 'management-supervision', 'management-coordinator'];
        
        managementZones.forEach(zone => {
            const zoneData = assignments[zone];
            if (zoneData && typeof zoneData === 'object' && !Array.isArray(zoneData)) {
                Object.entries(zoneData).forEach(([slot, id]) => {
                    if (id === staffId.toString()) {
                        updates[`assignments/${zone}/${slot}`] = null;
                    }
                });
            }
        });
        
        // Handle removal from regular zones (array-based)
        Object.entries(assignments).forEach(([zone, data]) => {
            if (!managementZones.includes(zone) && Array.isArray(data)) {
                if (data && data.includes(staffId.toString())) {
                    const newStaffIds = data.filter(id => id !== staffId.toString());
                    updates[`assignments/${zone}`] = newStaffIds.length > 0 ? newStaffIds : null;
                }
            }
        });
        
        // Add to the new specific slot
        updates[`assignments/${zoneId}/${slotIndex}`] = staffId.toString();
        
        // Update staff member status
        updates[`staffMembers/${staffId}/assigned`] = true;
        
        // Apply all updates atomically
        window.db.ref().update(updates);
    });
}

// Function to update staff assignment in Firebase
function updateAssignment(staffId, zoneId) {
    // First, remove this staff from any existing assignment
    window.db.ref('assignments').once('value', (snapshot) => {
        const assignments = snapshot.val() || {};
        
        // Create updates object
        let updates = {};
        
        // Handle removal from management zones (slot-based)
        const managementZones = ['management-operations', 'management-supervision', 'management-coordinator'];
        
        managementZones.forEach(zone => {
            const zoneData = assignments[zone];
            if (zoneData && typeof zoneData === 'object' && !Array.isArray(zoneData)) {
                Object.entries(zoneData).forEach(([slot, id]) => {
                    if (id === staffId.toString()) {
                        updates[`assignments/${zone}/${slot}`] = null;
                    }
                });
            }
        });
        
        // Handle removal from regular zones (array-based)
        Object.entries(assignments).forEach(([zone, data]) => {
            if (!managementZones.includes(zone) && Array.isArray(data)) {
                if (data && data.includes(staffId.toString())) {
                    const newStaffIds = data.filter(id => id !== staffId.toString());
                    updates[`assignments/${zone}`] = newStaffIds.length > 0 ? newStaffIds : null;
                }
            }
        });
        
        // Add to the new zone (for non-management zones)
        const currentZoneStaff = Array.isArray(assignments[zoneId]) 
            ? assignments[zoneId].filter(id => id !== staffId.toString())
            : [];
            
        currentZoneStaff.push(staffId.toString());
        updates[`assignments/${zoneId}`] = currentZoneStaff;
        
        // Update staff member status
        updates[`staffMembers/${staffId}/assigned`] = true;
        
        // Apply all updates atomically
        window.db.ref().update(updates);
    });
}

// Append staff to zone - helper function
function appendStaffToZone(staff, zone) {
    const staffCard = document.createElement('div');
    staffCard.className = `staff-card ${staff.shift === 'I' ? 'bg-[#242b4e]' : 'bg-[#2f3a6c]'} p-3 rounded-lg flex items-center justify-between`;
    staffCard.draggable = true;
    staffCard.dataset.staffId = staff.id;
    staffCard.innerHTML = `
        <div class="flex items-center gap-3">
            ${staff.photo
                ? `<img src="${staff.photo}" class="w-11 h-11 rounded-full object-cover">`
                : `<div class="w-11 h-11 bg-secondary rounded-full flex items-center justify-center">
                    ${staff.name.charAt(0)}
                  </div>`
            }
            <div>
                <div class="font-medium">${staff.name}</div>
                <div class="text-sm text-gray-400">Group ${staff.role}</div>
            </div>
        </div>
        <button onclick="event.stopPropagation(); deleteStaff(${staff.id})" class="text-gray-400 hover:text-red-500">
            <i class="ri-delete-bin-line"></i>
        </button>
    `;
    zone.appendChild(staffCard);
    staffCard.addEventListener('dragstart', handleDragStart);
    staffCard.addEventListener('dragend', handleDragEnd);
}

// Update productivity with Firebase
function updateProductivity(zone) {
    const operatorCount = zone.querySelectorAll('.staff-card').length;
    const rate = productivityRates[zone.dataset.zone];
    
    // Check X4/X5 requirement
    if (zone.dataset.zone === 'support-x4x5') {
        const titleSpan = zone.querySelector('.p-3 span');
        if (titleSpan) {
            titleSpan.className = operatorCount >= 1 ? '' : 'text-red-500';
        }
    }
    
    // Check I-Point requirement for long goods
    if (zone.dataset.zone === 'long-ipoint') {
        const titleSpan = zone.querySelector('.p-3 span:first-child');
        if (titleSpan) {
            titleSpan.className = operatorCount >= 1 ? '' : 'text-red-500';
        }
    }
    
    // Check training requirement
    if (zone.dataset.zone.includes('training')) {
        zone.style.backgroundColor = (operatorCount === 0 || operatorCount % 2 === 0) ? '' : 'rgba(239, 68, 68, 0.2)';
        const titleSpan = zone.querySelector('.p-3 span');
        if (titleSpan) {
            titleSpan.className = (operatorCount === 0 || operatorCount % 2 === 0) ? '' : 'text-red-500';
        }
    }
    
    // Check I-Point requirement
    if (zone.dataset.zone.includes('ipoint')) {
        const titleSpan = zone.querySelector('.p-3 span:first-child');
        if (titleSpan) {
            titleSpan.className = operatorCount >= 1 ? '' : 'text-red-500';
        }
    }
    
    if (rate) {
        const output = rate * operatorCount;
        const unit = zone.dataset.zone.includes('picking') ? 'lines/h' : 'boxes/h';
        const outputElement = document.getElementById(`${zone.dataset.zone}-output`);
        if (outputElement) {
            outputElement.textContent = `${output} ${unit}`;
            
            // Save this output in Firebase
            window.db.ref(`outputs/${zone.dataset.zone}`).set(`${output} ${unit}`);
        }
        
        // Check I-Point vs Packing output
        if (zone.dataset.zone === 'long-packing') {
            const iPointOutput = getZoneOutput('long-ipoint');
            if (output > iPointOutput) {
                document.querySelector('[data-zone="long-ipoint"]').style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            } else {
                document.querySelector('[data-zone="long-ipoint"]').style.backgroundColor = '';
            }
        }
        
        // Check Palletizing vs total boxes output
        if (zone.dataset.zone === 'long-palletizing') {
            const totalBoxesOutput = getZoneOutput('long-packing') + getZoneOutput('long-vas') + getZoneOutput('long-aortic') +
                getZoneOutput('small-packing') + getZoneOutput('small-vas') + getZoneOutput('small-heart-valves') +
                getZoneOutput('surgical-packing') + getZoneOutput('surgical-vas');
            const titleSpan = zone.querySelector('.p-3 span:first-child');
            if (titleSpan) {
                titleSpan.className = output >= totalBoxesOutput ? '' : 'text-red-500';
            }
        }
    }
}

function getZoneOutput(zoneId) {
    const zone = document.querySelector(`[data-zone="${zoneId}"]`);
    const operatorCount = zone.querySelectorAll('.staff-card').length;
    return productivityRates[zoneId] * operatorCount;
}

// Toggle functions for UI elements
function toggleBcpBod(event, id) {
    event.stopPropagation();
    if (isLocked) {
        alert('Planning is locked. Unlock it first.');
        return;
    }
    
    const button = document.getElementById(id);
    const newStatus = button.textContent === 'BCP' ? 'BOD' : 'BCP';
    
    // Update in Firebase
    window.db.ref('buttonStates/' + id).set(newStatus);
}

function toggleX4X5Status(event) {
    event.stopPropagation();
    if (isLocked) {
        alert('Planning is locked. Unlock it first.');
        return;
    }
    
    const button = document.getElementById('x4x5-status');
    const currentStatus = button.textContent;
    const statusMap = {
        'A': 'B',
        'B': 'A & B',
        'A & B': 'A'
    };
    const newStatus = statusMap[currentStatus];
    
    // Update in Firebase
    window.db.ref('buttonStates/x4x5-status').set(newStatus);
}

// Toggle section visibility
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle('expanded');
    
    // Store section state in Firebase
    window.db.ref(`sectionStates/${sectionId}`).set(section.classList.contains('expanded'));
    
    // Re-setup drag and drop after toggling
    setTimeout(() => {
        setupDragAndDrop();
    }, 300);
}

// Modal functions
function showAddStaffModal() {
    document.getElementById('addStaffModal').style.display = 'flex';
}

function hideAddStaffModal() {
    document.getElementById('addStaffModal').style.display = 'none';
}

function showAddSupportModal() {
    document.getElementById('addSupportModal').style.display = 'flex';
}

function hideAddSupportModal() {
    document.getElementById('addSupportModal').style.display = 'none';
}

function selectGroup(group) {
    document.querySelectorAll('.group-button').forEach(btn => {
        btn.classList.remove('border-secondary');
        btn.classList.add('border-transparent');
    });
    const selectedButton = document.querySelector(`[data-group="${group}"]`);
    selectedButton.classList.remove('border-transparent');
    selectedButton.classList.add('border-secondary');
    document.getElementById('staffRole').value = group;
}

function selectShift(shift) {
    document.querySelectorAll('.shift-button').forEach(btn => {
        btn.classList.remove('border-secondary');
        btn.classList.add('border-transparent');
    });
    const selectedButton = document.querySelector(`[data-shift="${shift}"]`);
    selectedButton.classList.remove('border-transparent');
    selectedButton.classList.add('border-secondary');
    document.getElementById('staffShift').value = shift;
}

function showStaffCard(staffId) {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return;
    
    const modal = document.getElementById('staffCardModal');
    const photo = document.getElementById('staffCardPhoto');
    const name = document.getElementById('staffCardName');
    const details = document.getElementById('staffCardDetails');
    
    if (staff.photo) {
        photo.innerHTML = `<img src="${staff.photo}" class="w-full h-full rounded-full object-cover">`;
    } else {
        photo.innerHTML = staff.name.charAt(0);
    }
    
    name.textContent = staff.name;
    details.innerHTML = `
        <div class="mb-2">Group ${staff.role}</div>
        <div>Shift ${staff.shift}</div>
    `;
    
    modal.style.display = 'flex';
}

function hideStaffCard() {
    document.getElementById('staffCardModal').style.display = 'none';
}

// Delete staff
function deleteStaff(id) {
    if (isLocked) {
        alert('Planning is locked. Unlock it first.');
        return;
    }
    
    if(confirm('Are you sure you want to delete this operator permanently?')) {
        // Remove from Firebase
        window.db.ref('staffMembers/' + id).remove();
        
        // Remove from any assignments
        window.db.ref('assignments').once('value', (snapshot) => {
            const assignments = snapshot.val() || {};
            let updates = {};
            const managementZones = ['management-operations', 'management-supervision', 'management-coordinator'];
            
            // Handle both data structures
            Object.entries(assignments).forEach(([zone, data]) => {
                if (managementZones.includes(zone) && typeof data === 'object' && !Array.isArray(data)) {
                    // Slot-based assignments
                    Object.entries(data).forEach(([slot, staffId]) => {
                        if (staffId === id.toString()) {
                            updates[`assignments/${zone}/${slot}`] = null;
                        }
                    });
                } else if (Array.isArray(data)) {
                    // Regular array-based assignments
                    if (data && data.includes(id.toString())) {
                        const newStaffIds = data.filter(staffId => staffId !== id.toString());
                        updates[`assignments/${zone}`] = newStaffIds.length > 0 ? newStaffIds : null;
                    }
                }
            });
            
            if (Object.keys(updates).length > 0) {
                window.db.ref().update(updates);
            }
        });
    }
}

// Initialize the page
init();