document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll('.student-screen').forEach(screen => {
    if (!screen.classList.contains('active')) {
      screen.style.display = 'none';
    } else {
      screen.style.display = 'block';
    }
  });

});



    function toggleCourse(id, headerElement) {
      const content = document.getElementById(id);
      const icon = headerElement.querySelector('.acc-icon');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)'; // Flecha apuntando arriba
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(180deg)'; // Flecha apuntando abajo
      }
    }
    
    function navigateToStudent(screenId) {
      document.getElementById('student-shell').style.display = 'flex';
      
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });

      document.querySelectorAll('.student-screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; 
      });
      
      document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('on'));
      
      const targetScreen = document.getElementById(screenId);
      if(targetScreen) {
        targetScreen.style.display = 'block'; 
        setTimeout(() => targetScreen.classList.add('active'), 10);
      }
      
      const targetNav = document.getElementById('nav-' + screenId.replace('s-', ''));
      if(targetNav) targetNav.classList.add('on');
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigateToFocus(screenId) {
      document.getElementById('student-shell').style.display = 'none';
      
      document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });
      
      const targetScreen = document.getElementById(screenId);
      if(targetScreen) {
        targetScreen.style.display = 'block';
        setTimeout(() => targetScreen.classList.add('active'), 10);
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function selectOption(element) {
      const container = element.parentElement;
      container.querySelectorAll('.qopt').forEach(opt => opt.classList.remove('sel'));
      element.classList.add('sel');
    }

