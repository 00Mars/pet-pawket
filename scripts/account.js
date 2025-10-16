    import { injectNavbar } from './navbar.js';
    import { injectFooter } from './footer.js';
    import { setupHueyAnimation } from './navbarAnimation.js';
    import { setupNavbarOverlayHandlers } from './navbarOverlay.js';
    import { updateCartBadge } from './cartUtils.js';
    import { logout, updateAuthDisplay} from './auth.js';


  injectNavbar(() => {
  setupNavbarOverlayHandlers();
  setupHueyAnimation();
  updateCartBadge();
});
    injectFooter();

    const userEmail = document.getElementById('userEmail');
    const accountActions = document.getElementById('accountActions');
    const logoutBtn = document.getElementById('logoutBtn');
    const token = localStorage.getItem("authToken");

    fetch("/api/me", {
    headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
    }
    })
      .then(res => {
        if (!res.ok) throw new Error("Not logged in");
        return res.json();
      })
      .then(data => {
  userEmail.textContent = data.email;
  accountActions.style.display = 'block';

  document.querySelectorAll('.requires-auth').forEach(el => {
    el.style.display = 'block';
  });

  loadProfile();
  loadOrders();
  loadPets();
}) 
.catch(() => {
  userEmail.textContent = "You are not logged in.";
  accountActions.style.display = 'none';
});


    logoutBtn.addEventListener("click", () => {
      logout();
    });

    // PROFILE FORM
    const profileForm = document.getElementById('profileForm');
    const profileFirstName = document.getElementById('profileFirstName');
    const profileLastName = document.getElementById('profileLastName');
    const profileEmail = document.getElementById('profileEmail');
    const profileStatus = document.getElementById('profileStatus');

    function loadProfile() {
    fetch("/api/profile", {
    headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
    }
    })
    .then(res => res.json())
    .then(({ firstName, lastName, email, preferences }) => {
      profileFirstName.value = firstName || '';
      profileLastName.value = lastName || '';
      profileEmail.value = email || '';
      // Optional: if using preferences, populate them here
    })
    .catch(err => {
      console.error('Failed to load profile:', err);
    });
}


    profileForm.addEventListener("submit", e => {
      e.preventDefault();
      profileStatus.style.display = 'none';

      const payload = {
        firstName: profileFirstName.value.trim(),
        lastName: profileLastName.value.trim(),
        email: profileEmail.value.trim()
      };

      fetch("/api/profile", {
        method: "POST",        
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        }
    ,
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        profileStatus.style.display = 'block';
        profileStatus.className = data.error ? 'text-danger' : 'text-success';
        profileStatus.textContent = data.error ? data.error : "Profile updated successfully!";
      })
      .catch(() => {
        profileStatus.style.display = 'block';
        profileStatus.className = 'text-danger';
        profileStatus.textContent = "An error occurred while updating your profile.";
      });
    });

    // ORDERS
    function loadOrders() {
      const container = document.getElementById('orderHistory');
      container.innerHTML = `<div class="spinner-border text-info" role="status"><span class="visually-hidden">Loading...</span></div>`;

      fetch("/api/orders", {
      headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
      }
      })
        .then(res => res.json())
        .then(data => {
          container.innerHTML = '';
          if (data.orders && data.orders.length > 0) {
            renderOrders(data.orders, container);
          } else {
            container.innerHTML = `<p class="text-muted">No orders found.</p>`;
          }
        })
        .catch(() => {
          container.innerHTML = `<p class="text-danger">Failed to load orders.</p>`;
        });
    }

    function renderOrders(orders, container) {
      orders.forEach(order => {
        const items = order.lineItems.edges.map(edge => `
          <li>${edge.node.quantity}× ${edge.node.title}</li>
        `).join('');

        const card = document.createElement('div');
        card.className = "card mb-3";
        card.innerHTML = `
          <div class="card-body">
            <h5 class="card-title">Order #${order.orderNumber}</h5>
            <p class="card-subtitle text-muted">${new Date(order.processedAt).toLocaleString()}</p>
            <p><strong>Total:</strong> ${order.totalPriceV2.amount} ${order.totalPriceV2.currencyCode}</p>
            <ul>${items}</ul>
            <a class="btn btn-outline-primary btn-sm" href="${order.statusUrl}" target="_blank">View Status</a>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function loadPets() {
    fetch("/api/profile", {
    headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
    }
    })
    .then(res => res.json())
    .then(({ pets }) => {
      const petList = document.getElementById("petList");
      petList.innerHTML = '';

      if (!pets || pets.length === 0) {
        petList.innerHTML = '<p class="text-muted">No pets added yet.</p>';
        return;
      }

      pets.forEach((pet, index) => {
        const card = document.createElement('div');
        const avatarUrl = pet.avatar || '/images/default-pet.png';
card.innerHTML = `
  <div class="card-body d-flex align-items-center">
    <img src="${avatarUrl}" class="rounded me-3" style="height: 60px; width: 60px; object-fit: cover;" />
    <div>
      <h5 class="card-title mb-1">${pet.name || 'Unnamed Pet'}</h5>
      <p class="card-subtitle text-muted mb-1">${pet.type || 'Unknown'}${pet.breed ? ` – ${pet.breed}` : ''} • ${pet.birthday || 'No birthday set'}</p>
      <p class="mb-1">Mood: <strong>${pet.mood || 'Unknown'}</strong> | Persona: ${pet.persona || 'Unset'}</p>
      <button class="btn btn-sm btn-outline-primary me-2" onclick="editPet(${index})">Edit</button>
      <button class="btn btn-sm btn-outline-secondary me-2" onclick="openJournal(${index})">Journal</button>
      <button class="btn btn-sm btn-outline-danger" onclick="deletePet(${index})">Delete</button>

    </div>
  </div>
`;
        petList.appendChild(card);

if (index < pets.length - 1) {
  const hr = document.createElement('hr');
  hr.className = 'my-4 text-muted';
  petList.appendChild(hr);
}
      });
    });
}

    function editPet(index) {
    fetch("/api/profile", {
    headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
    }
    })
    .then(res => res.json())
    .then(data => {
      const form = document.getElementById("editPetForm");
    if (!form) {
    console.error("editPetForm not found.");
    return;
    }

      const pet = data.pets[index];
      
      document.getElementById("editPetIndex").value = index;
      document.getElementById("editPetName").value = pet.name || '';
      document.getElementById("editPetType").value = pet.type || '';
      document.getElementById("editPetBreed").value = pet.breed || '';
      document.getElementById("editPetBirthday").value = pet.birthday || '';
      document.getElementById("editPetMood").value = pet.mood || 'Happy';
      document.getElementById("editPetPersona").value = pet.persona || 'Unset';
      
      
      const avatarPreview = document.getElementById("avatarPreview");
      const avatarInput = document.getElementById("editPetAvatar");
      avatarInput.value = "";
      avatarPreview.src = pet.avatar || '/assets/images/default-pet.png';
      avatarPreview.dataset.avatarPath = pet.avatar || '';
      document.getElementById("editPetModal").dataset.originalAvatar = pet.avatar || '';








// ✅ After rendering is complete, bind events
document.querySelectorAll(".edit-entry-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const petIndex = parseInt(document.getElementById("editPetIndex").value, 10);
    const entryIndex = parseInt(btn.dataset.entryIndex, 10);
    const entryWrapper = btn.closest(".journal-entry-wrapper");
    const currentNote = entryWrapper.querySelector(".journal-note").textContent.trim();
    const currentMood = entryWrapper.getAttribute("data-mood") || "Happy";
    const currentTags = Array.from(entryWrapper.querySelectorAll(".journal-tag")).map(tag => tag.textContent.trim().replace(/^#/, ''));
    const currentPhoto = entryWrapper.querySelector("img")?.getAttribute("src") || null;

    const moodOptions = [
      "Happy", "Sleepy", "Excited", "Anxious", "Lonely",
      "Curious", "Protective", "Mischievous", "Peaceful", "Inspired"
    ];

    const newNote = prompt("Edit journal note:", currentNote);
    if (newNote === null) return;

    const newMood = prompt(`Edit mood:\n(${moodOptions.join(", ")})`, currentMood);
    if (!newMood || !moodOptions.includes(newMood)) return alert("Invalid mood.");

    const newTags = prompt("Edit tags (comma separated):", currentTags.join(", ")) || "";
    const parsedTags = newTags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 10);

    const keepPhoto = confirm("Keep existing photo?");
    const updatedPhoto = keepPhoto ? currentPhoto : null;

    const currentDisplayDate = entryWrapper.getAttribute("data-display-date") || "";
    const customDate = prompt("Edit display date? (optional)\n(e.g. May 18, 2025, 4:15 PM)", currentDisplayDate);
    const displayDate = customDate?.trim() || undefined;

    const isCoreMemory = entryWrapper.getAttribute("data-highlighted") === 'true';


    fetch("/api/profile/edit-journal-entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
      body: JSON.stringify({
        petIndex,
        entryIndex,
        note: newNote,
        mood: newMood,
        tags: parsedTags,
        photo: updatedPhoto,
        displayDate,
        highlighted: isCoreMemory
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) editPet(petIndex);
      else alert("Failed to update entry.");
    });
  });
});



document.querySelectorAll(".delete-entry-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const entryIndex = btn.dataset.entryIndex;
    if (!confirm("Delete this entry?")) return;

    fetch("/api/profile/delete-journal-entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
      body: JSON.stringify({
        petIndex: index,
        entryIndex
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) editPet(index);
      else alert("Failed to delete entry.");
    });
  });
});


      showCustomModal('editPetModal');
    });
}



document.getElementById("editPetForm").addEventListener("submit", async e => {
  e.preventDefault();

  const index = document.getElementById("editPetIndex").value;

  const originalAvatar = document.getElementById("editPetModal").dataset.originalAvatar;

  const updatedPet = {
    name: document.getElementById("editPetName").value.trim(),
    type: document.getElementById("editPetType").value,
    breed: document.getElementById("editPetBreed").value.trim(),
    birthday: document.getElementById("editPetBirthday").value,
    mood: document.getElementById("editPetMood").value,
    persona: document.getElementById("editPetPersona").value,
    avatar: avatarPreview.dataset.avatarPath || ''
  };

  // Upload avatar if there's a new file
  if (avatarInput.files[0]) {
    const formData = new FormData();
    formData.append("avatar", avatarInput.files[0]);

    try {
      const uploadRes = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        updatedPet.avatar = uploadData.avatar;
      } else {
        alert(uploadData.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed.");
    }
  }

  // Save pet
  fetch("/api/profile/update-pet", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
    body: JSON.stringify({ index, updatedPet, originalAvatar })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      const modal = document.getElementById('editPetModal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 200);
      loadPets();
    } else {
      alert("Failed to update pet.");
    }
  });
});



function deletePet(index) {
  if (!confirm("Are you sure you want to delete this pet?")) return;

  fetch("/api/profile/delete-pet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
    body: JSON.stringify({ index })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      loadPets();
    } else {
      alert("Failed to delete pet.");
    }
  });
}

const addPetForm = document.getElementById("addPetForm");

addPetForm.addEventListener("submit", e => {
  e.preventDefault();

  const name = document.getElementById("newPetName").value.trim();
  const type = document.getElementById("newPetType").value.trim();
  const birthday = document.getElementById("newPetBirthday").value;

  fetch("/api/profile/add-pet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
    body: JSON.stringify({ name, type, birthday })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      addPetForm.reset();
      loadPets();
    } else {
      alert("Failed to add pet.");
    }
  });
});

const avatarInput = document.getElementById('editPetAvatar');
const avatarPreview = document.getElementById('avatarPreview');
const removeAvatarBtn = document.getElementById('removeAvatarBtn');

// Preview selected image (does not upload yet)
avatarInput.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      avatarPreview.src = e.target.result;
      avatarPreview.dataset.avatarPath = ""; // Clear any previous server path
    };
    reader.readAsDataURL(file);
  }
});

// Remove button
removeAvatarBtn.addEventListener('click', () => {
  avatarPreview.src = "/images/default-pet.png";
  avatarPreview.dataset.avatarPath = ""; // Mark for removal
  avatarInput.value = "";
});


window.editPet = editPet;
window.deletePet = deletePet;

document.getElementById("addJournalEntryBtn").addEventListener("click", () => {
  const note = document.getElementById("newJournalNote").value.trim();
  const petIndex = document.getElementById("journalPetIndex").value;
  const mood = document.getElementById("journalMood").value;
  const tagsRaw = document.getElementById("journalTags").value.trim();
  const tags = tagsRaw.length ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const photoFile = document.getElementById("journalPhoto").files[0];

  if (!note) return alert("Please write something first.");

  const formData = new FormData();
  formData.append("index", petIndex);
  formData.append("note", note);
  formData.append("mood", mood);
  formData.append("tags", JSON.stringify(tags));
  if (photoFile) formData.append("photo", photoFile);

  fetch("/api/profile/add-journal-entry", {
    method: "POST",
    headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
    }
    ,
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      document.getElementById("newJournalNote").value = "";
      document.getElementById("journalTags").value = "";
      document.getElementById("journalPhoto").value = "";
      document.getElementById("journalMood").value = "Happy";
      openJournal(petIndex); // Refresh journal view
    } else {
      alert("Failed to save entry.");
    }
  })
  .catch(err => {
    console.error("[add-journal-entry]", err);
    alert("An error occurred while saving.");
  });
});



function renderJournal(pet, petIndex) {
  const journal = document.getElementById("editPetJournal");
  journal.innerHTML = '';

 

  const reversed = [...(pet.journal || [])].reverse();
  reversed.forEach((entry, i) => {
    const originalIndex = pet.journal.length - 1 - i;
    const isLast = i === reversed.length - 1;

    const li = document.createElement("li");
    li.className = isLast ? 'pb-2' : 'pb-2 border-bottom mb-3';
    li.innerHTML = `
      <div class="d-flex gap-1 mb-2">
        <button class="btn btn-sm btn-outline-secondary edit-entry-btn" data-entry-index="${originalIndex}" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-entry-btn" data-entry-index="${originalIndex}" title="Delete">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div class="ps-1 journal-entry-content">
  <div class="journal-entry-date"><strong>${formattedDate}:</strong></div>
  <div class="journal-entry-note">${entry.note}</div>
</div>
    `;
    journal.appendChild(li);
  });

  // Bind events AFTER elements are added
  document.querySelectorAll(".edit-entry-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const petIndex = parseInt(document.getElementById("editPetIndex").value, 10);
    const entryIndex = parseInt(btn.dataset.entryIndex, 10);
    const entryWrapper = btn.closest(".journal-entry-wrapper");
    if (!entryWrapper) return;

    const currentNote = entryWrapper.querySelector(".journal-note")?.textContent.trim() || "";
    const currentMood = entryWrapper.getAttribute("data-mood") || "Happy";
    const currentTags = Array.from(entryWrapper.querySelectorAll(".journal-tag")).map(tag =>
      tag.textContent.trim().replace(/^#/, "")
    );
    const currentPhoto = entryWrapper.querySelector("img")?.getAttribute("src") || null;

    const moodOptions = [
      "Happy", "Sleepy", "Excited", "Anxious", "Lonely",
      "Curious", "Protective", "Mischievous", "Peaceful", "Inspired"
    ];

    const newNote = prompt("Edit journal note:", currentNote);
    if (newNote === null) return;

    const newMood = prompt(`Edit mood:\n(${moodOptions.join(", ")})`, currentMood);
    if (!newMood || !moodOptions.includes(newMood)) return alert("Invalid mood.");

    const newTags = prompt("Edit tags (comma separated):", currentTags.join(", ")) || "";
    const parsedTags = newTags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 10);

    const keepPhoto = confirm("Keep existing photo?");
    const updatedPhoto = keepPhoto ? currentPhoto : null;

    const currentDisplayDate = entryWrapper.getAttribute("data-display-date") || "";
    const customDate = prompt("Edit display date? (optional)\n(e.g. May 18, 2025, 4:15 PM)", currentDisplayDate);
    const displayDate = customDate?.trim() || undefined;



    fetch("/api/profile/edit-journal-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
      body: JSON.stringify({
        petIndex,
        entryIndex,
        note: newNote,
        mood: newMood,
        tags: parsedTags,
        photo: updatedPhoto,
        displayDate,
        highlighted: isCoreMemory
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) editPet(petIndex);
      else alert("Failed to update entry.");
    });
  });
});


  document.querySelectorAll(".delete-entry-btn").forEach(btn => {
    btn.onclick = () => {
      const index = parseInt(document.getElementById("editPetIndex").value, 10);
      const entryIndex = parseInt(btn.dataset.entryIndex, 10);
      if (!confirm("Delete this entry?")) return;

      fetch("/api/profile/delete-journal-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
        body: JSON.stringify({ petIndex: index, entryIndex })
      }).then(res => res.json()).then(data => {
        if (data.success) editPet(index);
        else alert("Failed to delete entry.");
      });
    };
  });
}

// Show custom modal
function showCustomModal(id) {
  document.querySelectorAll('.custom-modal').forEach(modal => {
    modal.classList.add('hidden');
    modal.classList.remove('visible');
  });
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
  }
}

// Hide modal via close button
document.querySelectorAll('.close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.close;
    const modal = document.getElementById(target);
    if (modal) {
      modal.classList.remove('visible');
      setTimeout(() => modal.classList.add('hidden'), 200);
    }
  });
});

function renderJournalEntries(entries) {
  const list = document.getElementById("journalEntryList");
  if (!list) return console.error("journalEntryList not found");
  list.innerHTML = "";

  const reversed = [...entries].reverse();

  reversed.forEach((entry, i) => {
    const originalIndex = entries.length - 1 - i;
    const formattedDate = entry.displayDate?.trim() || entry.date?.trim();

    const moodEmojiMap = {
      Happy: '😊', Sleepy: '😴', Excited: '🤩', Anxious: '😟', Lonely: '😢',
      Curious: '🤔', Protective: '🛡️', Mischievous: '😼', Peaceful: '🧘‍♂️', Inspired: '✨'
    };
    const emoji = moodEmojiMap[entry.mood] || '📝';

    const tagsHtml = (entry.tags || []).map(tag =>
      `<span class="journal-tag">#${tag.replace(/^#/, '')}</span>`
    ).join('');

    const photoHtml = entry.photo
      ? `<img src="${entry.photo}" alt="Journal Photo" class="img-fluid rounded mt-2" style="max-height: 200px;" />`
      : '';

    const li = document.createElement("li");
    li.className = "pb-3 pt-3";

    li.innerHTML = `
    
      <div class="journal-entry-wrapper" 
           data-mood="${entry.mood || 'Happy'}" 
           data-highlighted="${entry.highlighted === true}">
           
        <div class="ps-1 journal-entry-content">
          <div class="mb-2 d-flex justify-content-end">${tagsHtml}</div>
          <div class="journal-entry-date mb-3"><strong>${formattedDate} ${emoji}</strong></div>
          <div class="journal-note text-muted">${entry.note}</div>
          
          ${photoHtml}  
        </div>
        ${entry.highlighted ? '<div class="text-warning mt-1">🔓 Core Memory Unlocked</div>' : ''}
        <div class="journal-actions mt-2 d-flex justify-content-end">
  <div class="btn-group d-none d-sm-flex gap-2">
    <button class="btn btn-sm btn-outline-secondary edit-entry-btn" data-entry-index="${originalIndex}" title="Edit">✎</button>
    <button class="btn btn-sm btn-outline-danger delete-entry-btn" data-entry-index="${originalIndex}" title="Delete">✖</button>
    <button class="btn btn-sm btn-outline-warning toggle-core-btn" data-entry-index="${originalIndex}" title="${entry.highlighted ? 'Unmark Core Memory' : 'Mark as Core Memory'}">
    ${entry.highlighted ? '🔓' : '🔒'}
  </button>
  </div>

  <!-- Mobile toggle -->
  <div class="dropdown d-sm-none">
    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
      ⋯
    </button>
    <ul class="dropdown-menu dropdown-menu-end journal-dropdown">
  <li><button class="btn btn-sm btn-outline-secondary edit-entry-btn" data-entry-index="${originalIndex}" title="Edit">✎</button></li>
  <li><button class="btn btn-sm btn-outline-danger delete-entry-btn" data-entry-index="${originalIndex}" title="Delete">✖</button></li>
  <li><button class="btn btn-sm btn-outline-warning toggle-core-btn" data-entry-index="${originalIndex}" title="${entry.highlighted ? 'Unmark Core Memory' : 'Mark as Core Memory'}">
    ${entry.highlighted ? '🔓' : '🔒'}
  </button></li>
</ul>

  </div>
</div>
      </div>
    `;

    list.appendChild(li);
  });

  // 🔁 Rebind edit buttons
  document.querySelectorAll(".edit-entry-btn").forEach(btn => {
    btn.onclick = () => {
      const petIndex = parseInt(document.getElementById("journalPetIndex").value, 10);
      const entryIndex = parseInt(btn.dataset.entryIndex, 10);
      const entryWrapper = btn.closest(".journal-entry-wrapper");

      const currentNote = entryWrapper.querySelector(".journal-note")?.textContent.trim() || "";
      const currentMood = entryWrapper.getAttribute("data-mood") || "Happy";
      const currentTags = Array.from(entryWrapper.querySelectorAll(".journal-tag")).map(tag =>
        tag.textContent.trim().replace(/^#/, "")
      );
      const currentPhoto = entryWrapper.querySelector("img")?.getAttribute("src") || null;
      const currentFormattedDate = entryWrapper.querySelector(".journal-entry-date")?.textContent?.replace(/^[^\d]+/, "") || "";
      const isCoreMemory = entryWrapper.getAttribute("data-highlighted") === 'true';

      const newNote = prompt("Edit journal note:", currentNote);
      if (newNote === null) return;

      const moodOptions = ["Happy", "Sleepy", "Excited", "Anxious", "Lonely", "Curious", "Protective", "Mischievous", "Peaceful", "Inspired"];
      const newMood = prompt(`Edit mood:\n(${moodOptions.join(", ")})`, currentMood);
      if (!newMood || !moodOptions.includes(newMood)) return alert("Invalid mood.");

      const newTags = prompt("Edit tags (comma separated):", currentTags.join(", ")) || "";
      const parsedTags = newTags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 10);

      const keepPhoto = confirm("Keep existing photo?");
      const updatedPhoto = keepPhoto ? currentPhoto : null;

      const customDate = prompt("Edit display date? (optional)", currentFormattedDate);
      const displayDate = customDate?.trim() || undefined;

      fetch("/api/profile/edit-journal-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
        body: JSON.stringify({
          petIndex,
          entryIndex,
          note: newNote,
          mood: newMood,
          tags: parsedTags,
          photo: updatedPhoto,
          displayDate,
          highlighted: isCoreMemory
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) openJournal(petIndex);
        else alert("Failed to update entry.");
      });
    };
  });

  // 🔁 Rebind delete buttons
  document.querySelectorAll(".delete-entry-btn").forEach(btn => {
    btn.onclick = () => {
      const petIndex = parseInt(document.getElementById("journalPetIndex").value, 10);
      const entryIndex = parseInt(btn.dataset.entryIndex, 10);
      if (!confirm("Delete this entry?")) return;

      fetch("/api/profile/delete-journal-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
        body: JSON.stringify({ petIndex, entryIndex })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) openJournal(petIndex);
        else alert("Failed to delete entry.");
      });
    };
  });

  // 🔁 Rebind core memory toggle buttons
requestAnimationFrame(() => {
  document.querySelectorAll(".toggle-core-btn").forEach(btn => {
    btn.onclick = () => {
      console.log("Toggle Core Memory clicked:", btn.dataset.entryIndex); // ✅ add this

      const petIndex = parseInt(document.getElementById("journalPetIndex").value, 10);
      const entryIndex = parseInt(btn.dataset.entryIndex, 10);
      const wrapper = btn.closest(".journal-entry-wrapper");
      const isNowHighlighted = btn.textContent.trim() === '🔒';

      console.log("Sending to backend:", {
  petIndex,
  entryIndex,
  highlighted: isNowHighlighted
});

      fetch("/api/profile/edit-journal-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
        },
        body: JSON.stringify({
          petIndex,
          entryIndex,
          highlighted: isNowHighlighted
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) openJournal(petIndex);
        else alert("Failed to update core memory.");
      });
    };
  });
});

}



window.openJournal = function(index) {
  fetch("/api/profile", {
    headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
    }
    })
    .then(res => res.json())
    .then(data => {
      const pet = data.pets[index];
      document.getElementById("journalPetIndex").value = index;
      document.getElementById("newJournalNote").value = "";
      renderJournalEntries(pet.journal || []);
      showCustomModal('journalModal');
    });
};

document.addEventListener('keydown', e => {
  if (e.key === "Escape") {
    document.querySelectorAll('.custom-modal.visible').forEach(modal => {
      modal.classList.remove('visible');
      setTimeout(() => modal.classList.add('hidden'), 200);
    });
  }
});

document.querySelectorAll('.custom-modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    // Only close if clicked directly on the backdrop (not inside the modal content)
    if (e.target === modal) {
      modal.classList.remove('visible');
      setTimeout(() => modal.classList.add('hidden'), 200);
    }
  });
});


async function handleLogin(email, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUserId", data.user.id);
    location.reload(); // or hide modal / show dashboard
  } else {
    document.getElementById("login-error").style.display = "block";
  }
}

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    document.getElementById("login-error").style.display = "none";

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    await handleLogin(email, password);
  });
}

async function syncJWTLoginFromShopify() {
  const shopifyEmail = window.Shopify?.customer?.email;
  if (!shopifyEmail) return;

  const alreadyLoggedIn = localStorage.getItem("authToken");
  if (alreadyLoggedIn) return;

  // Sync JWT login using stored mirror password (or backend match)
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: shopifyEmail,
      password: "__shopify_link__" // predefined link or magic password
    })
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUserId", data.user.id);
  }
}
