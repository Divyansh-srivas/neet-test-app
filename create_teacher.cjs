const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://lroblmoznwogphurrxst.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyb2JsbW96bndvZ3BodXJyeHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzQwNDgsImV4cCI6MjA5ODQxMDA0OH0.jv-k41YSt8kBmqV0lfodZKUascTuC41mlqIDyrLACak'
const supabase = createClient(supabaseUrl, supabaseKey)

async function createTeacher() {
  const { data, error } = await supabase.auth.signUp({
    email: 'neogravix@gmail.com',
    password: 'Neogravix3029gaurav',
    options: {
      data: {
        full_name: 'Admin Teacher',
        role: 'teacher'
      }
    }
  })

  if (error) {
    console.error('Error creating user:', error.message)
  } else {
    console.log('Teacher account successfully created or already exists!')
  }
}

createTeacher()
