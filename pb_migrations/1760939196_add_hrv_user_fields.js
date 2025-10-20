/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("users")

  // Remove avatar field
  usersCollection.fields.removeById("file376926767")

  // Add HRV-specific fields
  usersCollection.fields.add(new Field({
    name: "lastLoginAt",
    type: "date",
    required: false
  }))

  usersCollection.fields.add(new Field({
    name: "age",
    type: "number",
    required: false
  }))

  usersCollection.fields.add(new Field({
    name: "gender",
    type: "text",
    required: false,
    options: {
      max: 50
    }
  }))

  usersCollection.fields.add(new Field({
    name: "weight",
    type: "number",
    required: false
  }))

  usersCollection.fields.add(new Field({
    name: "height",
    type: "number",
    required: false
  }))

  usersCollection.fields.add(new Field({
    name: "purpose",
    type: "text",
    required: false,
    options: {
      max: 255
    }
  }))

  usersCollection.fields.add(new Field({
    name: "profileCompleted",
    type: "bool",
    required: false
  }))

  usersCollection.fields.add(new Field({
    name: "onboardingCompletedAt",
    type: "date",
    required: false
  }))

  return app.save(usersCollection)
}, (app) => {
  const usersCollection = app.findCollectionByNameOrId("users")

  // Remove HRV fields
  usersCollection.fields.removeByName("onboardingCompletedAt")
  usersCollection.fields.removeByName("profileCompleted")
  usersCollection.fields.removeByName("purpose")
  usersCollection.fields.removeByName("height")
  usersCollection.fields.removeByName("weight")
  usersCollection.fields.removeByName("gender")
  usersCollection.fields.removeByName("age")
  usersCollection.fields.removeByName("lastLoginAt")

  // Add back avatar field
  usersCollection.fields.add(new Field({
    name: "avatar",
    type: "file",
    required: false,
    options: {
      maxSelect: 1,
      maxSize: 5242880,
      mimeTypes: [
        "image/jpeg",
        "image/png",
        "image/svg+xml",
        "image/gif",
        "image/webp"
      ]
    }
  }))

  return app.save(usersCollection)
})
